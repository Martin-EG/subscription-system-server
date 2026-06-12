import { Router } from 'express';
import type { AuthProvider } from '../../../application/ports/auth-provider.port.js';
import { LoginUseCase } from '../../../application/use-cases/login.use-case.js';
import { createLoginController } from '../controllers/auth.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { loginBodySchema } from '../schemas/auth.schemas.js';

export interface AuthRouterOptions {
  authProvider: AuthProvider;
  isProduction: boolean;
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router();
  const loginUseCase = new LoginUseCase(options.authProvider);

  // TODO(tech-debt): Add rate limiting and abuse protection before production rollout.
  router.post(
    '/login',
    validateBody(loginBodySchema),
    createLoginController(loginUseCase, options.isProduction),
  );

  return router;
}
