import { Router } from 'express';
import { AuthProvider } from '../../../application/ports';
import { notImplemented } from '../controllers';
import { authenticate } from '../middlewares';

export interface SubscriptionRouterOptions {
  authProvider: AuthProvider
}

export function createSubscriptionRouter({ authProvider }: SubscriptionRouterOptions): Router {
  const router = Router();

  router.post('/checkout', notImplemented);
  router.patch('/cancel', notImplemented);
  router.patch('/renew', notImplemented);
  router.get('/', authenticate(authProvider), notImplemented);
  router.get('/:userId', notImplemented);

  return router;
}


