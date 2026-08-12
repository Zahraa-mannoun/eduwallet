import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  changePasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  updateAdminCredentialsHandler,
} from './auth.controller';

// Credential-sensitive endpoints only — kept tight to slow down brute-forcing.
const AUTH_RATE_LIMIT = { max: 5, timeWindow: '1 minute' };
// /refresh and /me are session-restore/session-poll endpoints, not credential guesses: every
// app cold start hits /me once (retried on failure), every expired access token triggers a
// /refresh, and mobile screens (Dashboard, Profile) call /me again on every focus. Under the
// 5/min AUTH_RATE_LIMIT, normal navigation — or just reloading the app a couple of times in a
// row — could exhaust the quota and come back as a 429, which looked identical to "your
// session is invalid" and forced a logout that had nothing to do with the token actually being
// bad. Matches the READ_RATE_LIMIT convention used for other polled endpoints (wallet, cards).
const SESSION_RATE_LIMIT = { max: 60, timeWindow: '1 minute' };

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/register', { config: { rateLimit: AUTH_RATE_LIMIT } }, registerHandler);
  fastify.post('/login', { config: { rateLimit: AUTH_RATE_LIMIT } }, loginHandler);
  fastify.post(
    '/logout',
    { preHandler: authenticate, config: { rateLimit: AUTH_RATE_LIMIT } },
    logoutHandler
  );
  fastify.post('/refresh', { config: { rateLimit: SESSION_RATE_LIMIT } }, refreshHandler);
  fastify.get('/me', { preHandler: authenticate, config: { rateLimit: SESSION_RATE_LIMIT } }, meHandler);
  fastify.patch(
    '/change-password',
    { preHandler: authenticate, config: { rateLimit: AUTH_RATE_LIMIT } },
    changePasswordHandler
  );
  // Despite the URL, also used by the agent portal's Profile page — both ADMIN and AGENT get
  // an instant self-service email/password change with no approval workflow, unlike the
  // proof-of-identity email-change flow STUDENT/PARENT/INSTITUTION go through.
  fastify.patch(
    '/admin/update-credentials',
    {
      preHandler: [authenticate, requireRole('ADMIN', 'AGENT')],
      config: { rateLimit: AUTH_RATE_LIMIT },
    },
    updateAdminCredentialsHandler
  );
}
