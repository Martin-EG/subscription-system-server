import express from 'express';
import swaggerUi from 'swagger-ui-express';
import type { AuthProvider } from './application/ports';
import { UnauthorizedError } from './domain/errors';
import { createSupabaseAuthProvider } from './infrastructure/auth';
import { env } from './infrastructure/config/env.js';
import { errorHandler } from './presentation/http/middlewares';
import { openApiDocument } from './presentation/http/openapi.js';
import { 
  createAuthRouter,
  healthRouter,
  paymentRouter,
  subscriptionRouter 
} from './presentation/http/routes';

export interface AppDependencies {
  authProvider?: AuthProvider;
}

const unconfiguredAuthProvider: AuthProvider = {
  login: () => Promise.reject(new UnauthorizedError()),
  verifyAccessToken: () => Promise.reject(new UnauthorizedError()),
};

function getDefaultAuthProvider(): AuthProvider {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return unconfiguredAuthProvider;
  }

  return createSupabaseAuthProvider(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const authProvider = dependencies.authProvider ?? getDefaultAuthProvider();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use('/health', healthRouter);
  app.use(
    '/api/v1/auth',
    createAuthRouter({
      authProvider,
      isProduction: env.NODE_ENV === 'production',
    }),
  );
  app.use('/api/v1/subscriptions', subscriptionRouter);
  app.use('/api/v1/payments', paymentRouter);
  app.use(errorHandler);

  return app;
}
