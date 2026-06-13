import { createApp, getDefaultAuthProvider } from './app.js';
import {
  ExpireSubscriptionsUseCase,
  PublishPaymentNotificationsUseCase,
} from './application/use-cases';
import { env } from './infrastructure/config/env.js';
import { PrismaCheckoutTransaction } from './infrastructure/database/prisma/prisma-checkout.transaction.js';
import { PrismaIdempotencyRepository } from './infrastructure/database/prisma/prisma-idempotency.repository.js';
import { PrismaPaymentNotificationRepository } from './infrastructure/database/prisma/prisma-payment-notification.repository.js';
import { PrismaPaymentRepository } from './infrastructure/database/prisma/prisma-payment.repository.js';
import { PrismaPlanRepository } from './infrastructure/database/prisma/prisma-plan.repository.js';
import { PrismaRenewalTransaction } from './infrastructure/database/prisma/prisma-renewal.transaction.js';
import { PrismaSubscriptionRepository } from './infrastructure/database/prisma/prisma-subscription.repository.js';
import { PrismaSubscriptionExpirationRepository } from './infrastructure/database/prisma/prisma-subscription-expiration.repository.js';
import { createPrismaClient } from './infrastructure/database/prisma/prisma.client.js';
import { ConsoleEventPublisher } from './infrastructure/messaging/console-event.publisher.js';
import { PaymentNotificationWorker } from './infrastructure/messaging/payment-notification.worker.js';
import { SimulatedPaymentProcessor } from './infrastructure/payments/simulated-payment.processor.js';
import { SubscriptionExpirationWorker } from './infrastructure/subscriptions/subscription-expiration.worker.js';

const prisma = createPrismaClient();
const eventPublisher = new ConsoleEventPublisher();
const publishPaymentNotifications = new PublishPaymentNotificationsUseCase(
  new PrismaPaymentNotificationRepository(prisma),
  eventPublisher,
  {
    topic: env.PAYMENT_NOTIFICATION_TOPIC,
    batchSize: env.OUTBOX_BATCH_SIZE,
    maxRetries: env.OUTBOX_MAX_RETRIES,
  },
);
const paymentNotificationWorker = new PaymentNotificationWorker(publishPaymentNotifications, {
  pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
  onError: (error) => console.error('Payment notification worker failed', error),
});
const expireSubscriptions = new ExpireSubscriptionsUseCase(
  new PrismaSubscriptionExpirationRepository(prisma),
  env.SUBSCRIPTION_EXPIRATION_BATCH_SIZE,
);
const subscriptionExpirationWorker = new SubscriptionExpirationWorker(expireSubscriptions, {
  pollIntervalMs: env.SUBSCRIPTION_EXPIRATION_POLL_INTERVAL_MS,
  onError: (error) => console.error('Subscription expiration worker failed', error),
});
const app = createApp({
  authProvider: getDefaultAuthProvider(),
  checkoutTransaction: new PrismaCheckoutTransaction(prisma),
  idempotencyRepository: new PrismaIdempotencyRepository(prisma),
  paymentProcessor: new SimulatedPaymentProcessor(),
  paymentRepository: new PrismaPaymentRepository(prisma),
  planRepository: new PrismaPlanRepository(prisma),
  renewalTransaction: new PrismaRenewalTransaction(prisma),
  subscriptionRepository: new PrismaSubscriptionRepository(prisma),
});

const server = app.listen(env.PORT, () => {
  console.info(`Subscription API listening on port ${env.PORT}`);
  paymentNotificationWorker.start();
  subscriptionExpirationWorker.start();
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.info(`Received ${signal}; shutting down`);
  server.close();
  await paymentNotificationWorker.stop();
  await subscriptionExpirationWorker.stop();
  await eventPublisher.disconnect();
  await prisma.$disconnect();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
