import { PrismaCheckoutTransaction } from '../../../../src/infrastructure/database/prisma/prisma-checkout.transaction';

describe('PrismaCheckoutTransaction', () => {
  const startedAt = new Date('2026-06-13T12:00:00.000Z');
  const expiresAt = new Date('2026-07-13T12:00:00.000Z');
  const input = {
    userId: 'user-id',
    planId: 'plan-id',
    idempotencyId: 'idempotency-id',
    transactionId: 'transaction-id',
    amount: 99,
    currency: 'MXN',
    startedAt,
    expiresAt,
  };

  function createTransactionMocks() {
    const tx = {
      subscription: {
        upsert: jest.fn().mockResolvedValue({
          id: 'subscription-id',
          status: 'ACTIVE',
          expiresAt,
        }),
      },
      paymentLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      paymentNotification: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      userAccess: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
      idempotencyKey: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const transaction = jest.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );
    const prisma = {
      $transaction: transaction,
    };

    return { prisma, transaction, tx };
  }

  it('commits all checkout writes in one transaction', async () => {
    const { prisma, transaction, tx } = createTransactionMocks();
    const repository = new PrismaCheckoutTransaction(prisma as never);

    await expect(repository.completeCheckout(input)).resolves.toEqual({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.subscription.upsert).toHaveBeenCalledWith({
      where: {
        userId: input.userId,
      },
      create: {
        userId: input.userId,
        planId: input.planId,
        status: 'ACTIVE',
        startedAt,
        expiresAt,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
      },
      update: {
        planId: input.planId,
        status: 'ACTIVE',
        startedAt,
        expiresAt,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
      },
    });
    expect(tx.paymentLog.create).toHaveBeenCalledWith({
      data: {
        userId: input.userId,
        subscriptionId: 'subscription-id',
        amount: input.amount,
        currency: input.currency,
        status: 'SUCCEEDED',
        paymentDate: startedAt,
        transactionId: input.transactionId,
      },
    });
    expect(tx.paymentNotification.create).toHaveBeenCalledWith({
      data: {
        subscriptionId: 'subscription-id',
        eventType: 'PAYMENT_SUCCEEDED',
        payload: {
          amount: 99,
          currency: 'MXN',
          occurredAt: '2026-06-13T12:00:00.000Z',
          subscriptionId: 'subscription-id',
          transactionId: 'transaction-id',
          userId: 'user-id',
        },
      },
    });
    expect(tx.userAccess.upsert).toHaveBeenCalledWith({
      where: {
        userId: input.userId,
      },
      update: {
        hasPremiumAccess: true,
        validUntil: expiresAt,
        updatedAt: expect.any(Date) as unknown,
      },
      create: {
        userId: input.userId,
        hasPremiumAccess: true,
        validUntil: expiresAt,
        updatedAt: expect.any(Date) as unknown,
      },
    });
    expect(tx.idempotencyKey.update).toHaveBeenCalledWith({
      where: {
        id: input.idempotencyId,
        userId: input.userId,
        operation: 'CHECKOUT',
        status: 'PROCESSING',
      },
      data: {
        status: 'COMPLETED',
        resourceId: 'subscription-id',
        responseStatus: 200,
        responseBody: {
          subscriptionId: 'subscription-id',
          status: 'ACTIVE',
          expiresAt: expiresAt.toISOString(),
        },
      },
    });
  });

  it('stores a null expiration in the idempotent response', async () => {
    const { prisma, tx } = createTransactionMocks();
    tx.subscription.upsert.mockResolvedValue({
      id: 'subscription-id',
      status: 'ACTIVE',
      expiresAt: null,
    });
    const repository = new PrismaCheckoutTransaction(prisma as never);

    await repository.completeCheckout({
      ...input,
      expiresAt: null,
    });

    expect(tx.idempotencyKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responseBody: expect.objectContaining({
            expiresAt: null,
          }) as unknown,
        }) as unknown,
      }) as unknown,
    );
  });

  it('propagates a transaction failure and stops subsequent writes', async () => {
    const { prisma, tx } = createTransactionMocks();
    const error = new Error('payment log failed');
    tx.paymentLog.create.mockRejectedValue(error);
    const repository = new PrismaCheckoutTransaction(prisma as never);

    await expect(repository.completeCheckout(input)).rejects.toBe(error);
    expect(tx.paymentNotification.create).not.toHaveBeenCalled();
    expect(tx.userAccess.upsert).not.toHaveBeenCalled();
    expect(tx.idempotencyKey.update).not.toHaveBeenCalled();
  });
});
