import express from 'express';
import swaggerUi from 'swagger-ui-express';

import type {
  AuthProvider,
  CheckoutTransactionPort,
  IdempotencyRepository,
  PaymentProcessor,
  PaymentRepository,
  PlanRepository,
  RenewalTransactionPort,
  SubscriptionRepository,
} from './application/ports';
import { UnauthorizedError } from './domain/errors';
import { createSupabaseAuthProvider } from './infrastructure/auth';
import { env } from './infrastructure/config/env.js';
import { errorHandler } from './presentation/http/middlewares';
import { openApiDocument } from './presentation/http/openapi.js';
import {
  createAuthRouter,
  createPaymentRouter,
  createPlansRouter,
  createSubscriptionRouter,
  healthRouter,
} from './presentation/http/routes';

export interface AppDependencies {
  authProvider: AuthProvider;
  checkoutTransaction: CheckoutTransactionPort;
  idempotencyRepository: IdempotencyRepository;
  paymentProcessor: PaymentProcessor;
  paymentRepository: PaymentRepository;
  planRepository: PlanRepository;
  renewalTransaction: RenewalTransactionPort;
  subscriptionRepository: SubscriptionRepository;
}

const unconfiguredAuthProvider: AuthProvider = {
  login: () => Promise.reject(new UnauthorizedError()),
  verifyAccessToken: () => Promise.reject(new UnauthorizedError()),
};

export function getDefaultAuthProvider(): AuthProvider {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return unconfiguredAuthProvider;
  }

  return createSupabaseAuthProvider(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}

export function createApp({
  authProvider,
  checkoutTransaction,
  idempotencyRepository,
  paymentProcessor,
  paymentRepository,
  planRepository,
  renewalTransaction,
  subscriptionRepository,
}: AppDependencies) {
  const app = express();

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
  app.use(
    '/api/v1/subscriptions',
    createSubscriptionRouter({
      authProvider,
      checkoutTransaction,
      idempotencyRepository,
      paymentProcessor,
      planRepository,
      renewalTransaction,
      subscriptionRepository,
    }),
  );
  app.use(
    '/api/v1/payments',
    createPaymentRouter({
      authProvider,
      paymentRepository,
    }),
  );
  app.use(
    '/api/v1/plans',
    createPlansRouter({
      authProvider,
      planRepository,
    }),
  );
  app.use(errorHandler);

  return app;
}
