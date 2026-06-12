import { Router } from 'express';
import { notImplemented } from '../controllers/placeholder.controller.js';

export const subscriptionRouter = Router();

subscriptionRouter.post('/checkout', notImplemented);
subscriptionRouter.patch('/cancel', notImplemented);
subscriptionRouter.patch('/renew', notImplemented);
subscriptionRouter.get('/', notImplemented);
subscriptionRouter.get('/:userId', notImplemented);
