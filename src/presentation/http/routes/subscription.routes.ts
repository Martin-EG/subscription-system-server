import { Router } from 'express';
import type { AuthProvider, SubscriptionRepository } from '../../../application/ports';
import { notImplemented } from '../controllers';
import { authenticate } from '../middlewares';
import { createSubscriptionsController } from '../controllers/subscriptions.controller';
import { GetSubscriptionsUseCase } from '../../../application/use-cases';

export interface SubscriptionRouterOptions {
  authProvider: AuthProvider;
  subscriptionRepository: SubscriptionRepository;
}

export function createSubscriptionRouter({
  authProvider,
  subscriptionRepository,
}: SubscriptionRouterOptions): Router {
  const router = Router();
  const getSubscriptionsUseCase = new GetSubscriptionsUseCase(subscriptionRepository);

  router.post('/checkout', notImplemented);
  router.patch('/cancel', notImplemented);
  router.patch('/renew', notImplemented);
  router.get(
    '/',
    authenticate(authProvider),
    createSubscriptionsController(getSubscriptionsUseCase),
  );
  router.get('/:userId', notImplemented);

  return router;
}
