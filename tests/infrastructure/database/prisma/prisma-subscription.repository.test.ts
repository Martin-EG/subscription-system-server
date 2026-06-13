import { PrismaSubscriptionRepository } from '../../../../src/infrastructure/database/prisma/prisma-subscription.repository';

describe('PrismaSubscriptionRepository', () => {
  const mappedSubscription = {
    id: 'subscription-id',
    userId: 'user-id',
    planId: 'plan-id',
    status: 'ACTIVE',
    startedAt: new Date('2026-06-12T00:00:00.000Z'),
    expiresAt: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    user: {
      name: 'Jane Doe',
      email: 'jane@example.com',
    },
    plan: {
      name: 'Gratis',
      price: { toNumber: () => 0 },
      currency: 'MXN',
      billingPeriod: null,
    },
  };

  it('finds only the latest current subscription for a user', async () => {
    const findFirst = jest.fn().mockResolvedValue(mappedSubscription);
    const prisma = {
      subscription: {
        findFirst,
      },
    };
    const repository = new PrismaSubscriptionRepository(prisma as never);

    await expect(repository.findCurrentByUserId('user-id')).resolves.toMatchObject({
      subscriptionId: 'subscription-id',
      userId: 'user-id',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
      },
      include: {
        user: true,
        plan: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
  });

  it('returns a paginated list and total of current subscriptions', async () => {
    const findMany = jest.fn();
    const count = jest.fn();
    const transaction = jest.fn().mockResolvedValue([[mappedSubscription], 1]);
    const prisma = {
      subscription: {
        findMany,
        count,
      },
      $transaction: transaction,
    };
    const repository = new PrismaSubscriptionRepository(prisma as never);

    await expect(repository.findAll({ page: 2, limit: 10 })).resolves.toMatchObject({
      total: 1,
      items: [{ subscriptionId: 'subscription-id' }],
    });
    expect(findMany).toHaveBeenCalledWith({
      include: {
        user: true,
        plan: true,
      },
      skip: 10,
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    });
    expect(count).toHaveBeenCalledWith();
  });

  it('returns null when the user has no current subscription', async () => {
    const prisma = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const repository = new PrismaSubscriptionRepository(prisma as never);

    await expect(repository.findCurrentByUserId('user-id')).resolves.toBeNull();
  });
});
