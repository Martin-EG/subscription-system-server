import type { RequestHandler } from 'express';
import type { AuthProvider } from '../../../application/ports/auth-provider.port.js';
import { UnauthorizedError } from '../../../domain/errors/unauthorized.error.js';

export function authenticate(authProvider: AuthProvider): RequestHandler {
  return async (request, response, next) => {
    const authorization = request.header('authorization');
    const [scheme, accessToken] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !accessToken) {
      response.status(401).end();
      return;
    }

    try {
      response.locals.authUser = await authProvider.verifyAccessToken(accessToken);
      next();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        response.status(401).end();
        return;
      }

      next(error);
    }
  };
}
