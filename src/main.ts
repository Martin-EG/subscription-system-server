import { createApp, getDefaultAuthProvider } from './app.js';
import { env } from './infrastructure/config/env.js';
import { PrismaCheckoutTransaction } from './infrastructure/database/prisma/prisma-checkout.transaction.js';
import { PrismaIdempotencyRepository } from './infrastructure/database/prisma/prisma-idempotency.repository.js';
import { PrismaPlanRepository } from './infrastructure/database/prisma/prisma-plan.repository.js';
import { PrismaSubscriptionRepository } from './infrastructure/database/prisma/prisma-subscription.repository.js';
import { createPrismaClient } from './infrastructure/database/prisma/prisma.client.js';
import { SimulatedPaymentProcessor } from './infrastructure/payments/simulated-payment.processor.js';

const prisma = createPrismaClient();

const app = createApp({
  authProvider: getDefaultAuthProvider(),
  checkoutTransaction: new PrismaCheckoutTransaction(prisma),
  idempotencyRepository: new PrismaIdempotencyRepository(prisma),
  paymentProcessor: new SimulatedPaymentProcessor(),
  planRepository: new PrismaPlanRepository(prisma),
  subscriptionRepository: new PrismaSubscriptionRepository(prisma),
});

app.listen(env.PORT, () => {
  console.info(`Subscription API listening on port ${env.PORT}`);
});
