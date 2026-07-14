import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../utils/AppError';
import type { LoginInput, RegisterInput } from './auth.schema';
import { toSafeUser } from './auth.types';
import type { AccessTokenPayload, RefreshTokenPayload, SafeUser } from './auth.types';

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const BLACKLIST_FALLBACK_TTL_SECONDS = 15 * 60;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 15 * 60;

const refreshTokenKey = (userId: string) => `auth:refresh:${userId}`;
const blacklistKey = (token: string) => `auth:blacklist:${token}`;
const loginAttemptsKey = (email: string) => `auth:login_attempts:${email}`;
const loginLockoutKey = (email: string) => `auth:login_lockout:${email}`;

export async function registerUser(input: RegisterInput): Promise<SafeUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      fullName: input.fullName,
      userType: input.userType,
      wallets: {
        create: {
          balance: 0,
        },
      },
    },
  });

  return toSafeUser(user);
}

async function assertNotLockedOut(email: string): Promise<void> {
  const locked = await redis.get(loginLockoutKey(email));
  if (locked) {
    throw new AppError(
      423,
      'ACCOUNT_LOCKED',
      'Too many failed login attempts. Please try again in 15 minutes.'
    );
  }
}

async function recordFailedLoginAttempt(email: string): Promise<void> {
  const key = loginAttemptsKey(email);
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, LOGIN_LOCKOUT_SECONDS);
  }
  if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    await redis.set(loginLockoutKey(email), '1', 'EX', LOGIN_LOCKOUT_SECONDS);
  }
}

async function clearFailedLoginAttempts(email: string): Promise<void> {
  await redis.del(loginAttemptsKey(email), loginLockoutKey(email));
}

async function issueTokens(
  app: FastifyInstance,
  userId: string,
  email: string,
  userType: SafeUser['userType']
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessPayload: AccessTokenPayload = { sub: userId, email, userType, type: 'access' };
  const refreshPayload: RefreshTokenPayload = { sub: userId, type: 'refresh' };

  const accessToken = app.jwt.sign(accessPayload, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
  const refreshToken = app.jwt.sign(refreshPayload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });

  await redis.set(refreshTokenKey(userId), refreshToken, 'EX', REFRESH_TOKEN_TTL_SECONDS);

  return { accessToken, refreshToken };
}

export async function loginUser(
  app: FastifyInstance,
  input: LoginInput
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  await assertNotLockedOut(input.email);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await recordFailedLoginAttempt(input.email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.suspended) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);
  if (!passwordMatches) {
    await recordFailedLoginAttempt(input.email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await clearFailedLoginAttempts(input.email);

  const { accessToken, refreshToken } = await issueTokens(app, user.id, user.email, user.userType);

  return { user: toSafeUser(user), accessToken, refreshToken };
}

export async function logoutUser(
  app: FastifyInstance,
  accessToken: string,
  userId: string
): Promise<void> {
  const decoded = app.jwt.decode<{ exp?: number }>(accessToken);
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const ttl =
    decoded?.exp && decoded.exp > nowInSeconds
      ? decoded.exp - nowInSeconds
      : BLACKLIST_FALLBACK_TTL_SECONDS;

  await redis.set(blacklistKey(accessToken), '1', 'EX', ttl);
  await redis.del(refreshTokenKey(userId));
}

export async function refreshAccessToken(
  app: FastifyInstance,
  refreshToken: string
): Promise<{ accessToken: string }> {
  let payload: RefreshTokenPayload;
  try {
    payload = app.jwt.verify<RefreshTokenPayload>(refreshToken);
  } catch {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
  }

  if (payload.type !== 'refresh') {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Token is not a refresh token');
  }

  const storedToken = await redis.get(refreshTokenKey(payload.sub));
  if (!storedToken || storedToken !== refreshToken) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token has been revoked');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new AppError(401, 'USER_NOT_FOUND', 'User no longer exists');
  }

  const accessPayload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    userType: user.userType,
    type: 'access',
  };
  const accessToken = app.jwt.sign(accessPayload, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });

  return { accessToken };
}

export async function getCurrentUser(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return toSafeUser(user);
}
