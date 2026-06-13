import { Router } from 'express';
import type {
  AuthProvider,
  CheckoutTransactionPort,
  IdempotencyRepository,
  PaymentProcessor,
  PlanRepository,
  RenewalTransactionPort,
  SubscriptionRepository,
} from '../../../application/ports';
import { createCheckoutSubscriptionController, notImplemented } from '../controllers';
import { authenticate, validateBody } from '../middlewares';
import {
  createCancelSubscriptionController,
  createRenewSubscriptionController,
  createSubscriptionsController,
} from '../controllers/subscriptions.controller';
import {
  CancelSubscriptionUseCase,
  CheckoutSubscriptionUseCase,
  GetSubscriptionsUseCase,
  RenewSubscriptionUseCase,
} from '../../../application/use-cases';
import { renewSubscriptionBodySchema } from '../schemas';

export interface SubscriptionRouterOptions {
  authProvider: AuthProvider;
  subscriptionRepository: SubscriptionRepository;
  planRepository: PlanRepository;
  idempotencyRepository: IdempotencyRepository;
  paymentProcessor: PaymentProcessor;
  checkoutTransaction: CheckoutTransactionPort;
  renewalTransaction: RenewalTransactionPort;
}

export function createSubscriptionRouter({
  authProvider,
  checkoutTransaction,
  idempotencyRepository,
  paymentProcessor,
  planRepository,
  renewalTransaction,
  subscriptionRepository,
}: SubscriptionRouterOptions): Router {
  const router = Router();
  const getSubscriptionsUseCase = new GetSubscriptionsUseCase(subscriptionRepository);
  const cancelSubscriptionUseCase = new CancelSubscriptionUseCase(subscriptionRepository);
  const renewSubscriptionUseCase = new RenewSubscriptionUseCase(
    subscriptionRepository,
    idempotencyRepository,
    paymentProcessor,
    renewalTransaction,
  );
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
  router.patch(
    '/cancel',
    authenticate(authProvider),
    createCancelSubscriptionController(cancelSubscriptionUseCase),
  );
  router.patch(
    '/renew',
    authenticate(authProvider),
    validateBody(renewSubscriptionBodySchema),
    createRenewSubscriptionController(renewSubscriptionUseCase),
  );
  router.get(
    '/',
    authenticate(authProvider),
    createSubscriptionsController(getSubscriptionsUseCase),
  );
  router.get('/:userId', notImplemented);

  return router;
}
