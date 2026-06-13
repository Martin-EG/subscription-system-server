import { PrismaPg } from '@prisma/adapter-pg';
import { CheckoutSubscriptionUseCase } from '../../src/application/use-cases';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaCheckoutTransaction } from '../../src/infrastructure/database/prisma/prisma-checkout.transaction';
import { PrismaIdempotencyRepository } from '../../src/infrastructure/database/prisma/prisma-idempotency.repository';
import { PrismaPlanRepository } from '../../src/infrastructure/database/prisma/prisma-plan.repository';
import { SimulatedPaymentProcessor } from '../../src/infrastructure/payments/simulated-payment.processor';

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const freePlanId = '33333333-3333-4333-8333-333333333333';
const premiumPlanId = '44444444-4444-4444-8444-444444444444';
const processedAt = new Date('2026-06-13T12:00:00.000Z');
const expiresAt = new Date('2026-07-13T12:00:00.000Z');

async function cleanDatabase() {
  await prisma.paymentNotification.deleteMany();
  await prisma.paymentLog.deleteMany();
  await prisma.userAccess.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.user.deleteMany();
}

async function seedCheckoutUser() {
  await prisma.user.create({
    data: {
      id: userId,
      name: 'Integration User',
      email: 'integration@example.com',
    },
  });
  await prisma.plan.createMany({
    data: [
      {
        id: freePlanId,
        name: 'Free',
        price: 0,
        currency: 'MXN',
        billingPeriod: null,
      },
      {
        id: premiumPlanId,
        name: 'Premium monthly',
        price: 99,
        currency: 'MXN',
        billingPeriod: 'MONTHLY',
      },
    ],
  });
  await prisma.subscription.create({
    data: {
      userId,
      planId: freePlanId,
      status: 'ACTIVE',
      startedAt: new Date('2026-06-01T00:00:00.000Z'),
      expiresAt: null,
    },
  });
}

function createCheckoutUseCase(transactionId: string) {
  return new CheckoutSubscriptionUseCase(
    new PrismaPlanRepository(prisma),
    new PrismaIdempotencyRepository(prisma),
    new SimulatedPaymentProcessor(
      () => transactionId,
      () => processedAt,
    ),
    new PrismaCheckoutTransaction(prisma),
    () => new Date('2026-06-13T11:59:00.000Z'),
  );
}

describe('PostgreSQL checkout integration', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await seedCheckoutUser();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('persists the subscription, access, payment, outbox and idempotency result', async () => {
    const useCase = createCheckoutUseCase('integration-success');

    await expect(
      useCase.execute({
        userId,
        planId: premiumPlanId,
        paymentMethod: 'simulated-card',
        idempotencyKey: 'integration-checkout-success',
      }),
    ).resolves.toEqual({
      subscriptionId: expect.any(String) as unknown,
      status: 'ACTIVE',
      expiresAt,
      cancelAtPeriodEnd: false,
    });

    const [subscription, access, paymentLogs, notifications, idempotency] = await Promise.all([
      prisma.subscription.findUniqueOrThrow({ where: { userId } }),
      prisma.userAccess.findUniqueOrThrow({ where: { userId } }),
      prisma.paymentLog.findMany({ where: { userId } }),
      prisma.paymentNotification.findMany(),
      prisma.idempotencyKey.findUniqueOrThrow({
        where: {
          userId_operation_key: {
            userId,
            operation: 'CHECKOUT',
            key: 'integration-checkout-success',
          },
        },
      }),
    ]);

    expect(subscription).toMatchObject({
      planId: premiumPlanId,
      status: 'ACTIVE',
      startedAt: processedAt,
      expiresAt,
      cancelAtPeriodEnd: false,
    });
    expect(access).toMatchObject({
      hasPremiumAccess: true,
      validUntil: expiresAt,
    });
    expect(paymentLogs).toHaveLength(1);
    expect(paymentLogs[0]).toMatchObject({
      subscriptionId: subscription.id,
      currency: 'MXN',
      status: 'SUCCEEDED',
      transactionId: 'integration-success',
    });
    expect(paymentLogs[0]?.amount.toString()).toBe('99');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      subscriptionId: subscription.id,
      eventType: 'PAYMENT_SUCCEEDED',
      status: 'PENDING',
    });
    expect(idempotency).toMatchObject({
      status: 'COMPLETED',
      resourceId: subscription.id,
      responseStatus: 200,
    });
  });

  it('rolls back checkout writes when the payment log violates a unique constraint', async () => {
    await prisma.user.create({
      data: {
        id: otherUserId,
        name: 'Other Integration User',
        email: 'other-integration@example.com',
      },
    });
    const otherSubscription = await prisma.subscription.create({
      data: {
        userId: otherUserId,
        planId: freePlanId,
        status: 'ACTIVE',
        startedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    });
    await prisma.paymentLog.create({
      data: {
        userId: otherUserId,
        subscriptionId: otherSubscription.id,
        amount: 99,
        currency: 'MXN',
        status: 'SUCCEEDED',
        paymentDate: processedAt,
        transactionId: 'integration-duplicate',
      },
    });
    const originalSubscription = await prisma.subscription.findUniqueOrThrow({
      where: { userId },
    });
    const useCase = createCheckoutUseCase('integration-duplicate');

    await expect(
      useCase.execute({
        userId,
        planId: premiumPlanId,
        paymentMethod: 'simulated-card',
        idempotencyKey: 'integration-checkout-rollback',
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const [subscription, access, paymentLogs, notifications, idempotency] = await Promise.all([
      prisma.subscription.findUniqueOrThrow({ where: { userId } }),
      prisma.userAccess.findUnique({ where: { userId } }),
      prisma.paymentLog.findMany({ where: { userId } }),
      prisma.paymentNotification.findMany({
        where: { subscriptionId: originalSubscription.id },
      }),
      prisma.idempotencyKey.findUniqueOrThrow({
        where: {
          userId_operation_key: {
            userId,
            operation: 'CHECKOUT',
            key: 'integration-checkout-rollback',
          },
        },
      }),
    ]);

    expect(subscription).toMatchObject({
      id: originalSubscription.id,
      planId: freePlanId,
      status: 'ACTIVE',
      expiresAt: null,
    });
    expect(access).toBeNull();
    expect(paymentLogs).toHaveLength(0);
    expect(notifications).toHaveLength(0);
    expect(idempotency.status).toBe('FAILED');
  });
});
