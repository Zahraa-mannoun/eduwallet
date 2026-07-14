import type { User, UserType } from '@prisma/client';

export type SafeUser = Omit<User, 'password'>;

export function toSafeUser(user: User): SafeUser {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export type AccessTokenPayload = {
  sub: string;
  email: string;
  userType: UserType;
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  type: 'refresh';
};

export type AuthTokenPayload = AccessTokenPayload | RefreshTokenPayload;
