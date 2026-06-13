import { Router } from 'express';
import { AuthProvider, PaymentRepository } from '../../../application/ports';
import { GetPaymentLogsUseCase } from '../../../application/use-cases/get-payment-logs.use-case.js';
import { authenticate } from '../middlewares/authenticate.middleware.js';
import { createPaymentLogsController } from '../controllers/payments.controller.js';

export interface PaymentRouterOptions {
  authProvider: AuthProvider;
  paymentRepository: PaymentRepository;
}

export function createPaymentRouter({
    authProvider,
    paymentRepository
}: PaymentRouterOptions): Router {
    const router = Router();
    const getPaymentLogsUseCase = new GetPaymentLogsUseCase(paymentRepository);

    router.get(
        '/',
        authenticate(authProvider),
        createPaymentLogsController(getPaymentLogsUseCase)
    );

    return router;
}

