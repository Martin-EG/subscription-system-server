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

    await expect(repository.findByUserId('user-id')).resolves.toMatchObject({
      subscriptionId: 'subscription-id',
      userId: 'user-id',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        status: {
          in: ['ACTIVE', 'PAST_DUE'],
        },
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
      where: {
        status: {
          in: ['ACTIVE', 'PAST_DUE'],
        },
      },
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
    expect(count).toHaveBeenCalledWith({
      where: {
        status: {
          in: ['ACTIVE', 'PAST_DUE'],
        },
      },
    });
  });

  it('returns null when the user has no current subscription', async () => {
    const prisma = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const repository = new PrismaSubscriptionRepository(prisma as never);

    await expect(repository.findByUserId('user-id')).resolves.toBeNull();
  });

  it('finds the latest subscription eligible for renewal', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      ...mappedSubscription,
      status: 'CANCELLED',
      expiresAt: new Date('2026-07-12T00:00:00.000Z'),
      plan: {
        ...mappedSubscription.plan,
        price: { toNumber: () => 99 },
        billingPeriod: 'MONTHLY',
      },
    });
    const repository = new PrismaSubscriptionRepository({
      subscription: { findFirst },
    } as never);

    await expect(repository.findRenewableByUserId('user-id')).resolves.toMatchObject({
      subscriptionId: 'subscription-id',
      status: 'CANCELLED',
      billingPeriod: 'MONTHLY',
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-id',
          status: { in: ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] },
        },
      }),
    );
  });

  it('schedules cancellation and preserves premium access until expiration', async () => {
    const expiresAt = new Date('2026-07-12T00:00:00.000Z');
    const transactionClient = {
      subscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          ...mappedSubscription,
          expiresAt,
          cancelAtPeriodEnd: true,
        }),
      },
      userAccess: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const transaction = jest
      .fn()
      .mockImplementation((callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient),
      );
    const repository = new PrismaSubscriptionRepository({
      $transaction: transaction,
    } as never);

    await expect(
      repository.scheduleCancellation({
        subscriptionId: 'subscription-id',
        userId: 'user-id',
        cancelledAt: new Date('2026-06-13T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ cancelAtPeriodEnd: true, expiresAt });
    expect(transactionClient.userAccess.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      create: {
        userId: 'user-id',
        hasPremiumAccess: true,
        validUntil: expiresAt,
      },
      update: {
        hasPremiumAccess: true,
        validUntil: expiresAt,
      },
    });
  });

  it('returns a completed renewal for a repeated idempotency key', async () => {
    const transactionClient = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue({
          requestHash: 'request-hash',
          status: 'COMPLETED',
          responseBody: {
            subscriptionId: 'subscription-id',
            status: 'ACTIVE',
            expiresAt: '2026-07-13T00:00:00.000Z',
            cancelAtPeriodEnd: false,
          },
        }),
      },
    };
    const transaction = jest
      .fn()
      .mockImplementation((callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient),
      );
    const repository = new PrismaSubscriptionRepository({
      $transaction: transaction,
    } as never);

    await expect(
      repository.renew({
        subscriptionId: 'subscription-id',
        userId: 'user-id',
        startedAt: new Date('2026-06-13T00:00:00.000Z'),
        expiresAt: new Date('2026-07-13T00:00:00.000Z'),
        requestHash: 'request-hash',
        idempotencyKey: 'renew-request-1',
        idempotencyExpiresAt: new Date('2026-06-14T00:00:00.000Z'),
      }),
    ).resolves.toEqual({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt: new Date('2026-07-13T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
    });
  });
});
