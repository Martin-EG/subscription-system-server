import { Router } from 'express';
import type { AuthProvider } from '../../../application/ports';
import { LoginUseCase } from '../../../application/use-cases';
import { createLoginController } from '../controllers';
import { validateBody } from '../middlewares';
import { loginBodySchema } from '../schemas';

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
