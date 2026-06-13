import { Router } from 'express';
import type {
  AuthProvider,
  CheckoutTransactionPort,
  IdempotencyRepository,
  PaymentProcessor,
  PlanRepository,
  SubscriptionRepository,
} from '../../../application/ports';
import { notImplemented } from '../controllers';
import { authenticate } from '../middlewares';
import {
  createCheckoutSubscriptionController,
  createSubscriptionsController,
} from '../controllers';
import {
  CheckoutSubscriptionUseCase,
  GetSubscriptionsUseCase,
} from '../../../application/use-cases';

export interface SubscriptionRouterOptions {
  authProvider: AuthProvider;
  subscriptionRepository: SubscriptionRepository;
  planRepository: PlanRepository;
  idempotencyRepository: IdempotencyRepository;
  paymentProcessor: PaymentProcessor;
  checkoutTransaction: CheckoutTransactionPort;
}

export function createSubscriptionRouter({
  authProvider,
  checkoutTransaction,
  idempotencyRepository,
  paymentProcessor,
  planRepository,
  subscriptionRepository,
}: SubscriptionRouterOptions): Router {
  const router = Router();
  const getSubscriptionsUseCase = new GetSubscriptionsUseCase(subscriptionRepository);
  const checkoutSubscriptionUseCase = new CheckoutSubscriptionUseCase(
    planRepository,
    idempotencyRepository,
    paymentProcessor,
    checkoutTransaction,
  );

  router.post(
    '/checkout',
    authenticate(authProvider),
    createCheckoutSubscriptionController(checkoutSubscriptionUseCase),
  );
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
