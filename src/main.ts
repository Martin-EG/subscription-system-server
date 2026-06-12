import { createApp, getDefaultAuthProvider } from './app.js';
import { env } from './infrastructure/config/env.js';
import { PrismaSubscriptionRepository } from './infrastructure/database/prisma/prisma-subscription.repository.js';
import { createPrismaClient } from './infrastructure/database/prisma/prisma.client.js';

const prisma = createPrismaClient();

const app = createApp({
  authProvider: getDefaultAuthProvider(),
  subscriptionRepository: new PrismaSubscriptionRepository(prisma),
});

app.listen(env.PORT, () => {
  console.info(`Subscription API listening on port ${env.PORT}`);
});
