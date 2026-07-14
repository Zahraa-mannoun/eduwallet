import type { UserType } from '@prisma/client';
import type { AuthTokenPayload } from '../modules/auth/auth.types';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
      userType: UserType;
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}
