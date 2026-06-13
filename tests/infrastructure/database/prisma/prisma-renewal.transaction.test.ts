import { PrismaRenewalTransaction } from '../../../../src/infrastructure/database/prisma/prisma-renewal.transaction';

describe('PrismaRenewalTransaction', () => {
  const validatedAt = new Date('2026-06-13T10:00:00.000Z');
  const startedAt = new Date('2026-06-13T10:01:00.000Z');
  const expiresAt = new Date('2026-07-13T10:01:00.000Z');
  const input = {
    userId: 'user-id',
    subscriptionId: 'subscription-id',
    idempotencyId: 'idempotency-id',
    validatedAt,
    startedAt,
    expiresAt,
    payment: {
      transactionId: 'transaction-id',
      amount: 99,
      currency: 'MXN',
      processedAt: startedAt,
    },
  };

  function createTransactionMocks() {
    const tx = {
      subscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

  it('commits the subscription, payment, outbox, access and idempotency writes together', async () => {
    const { prisma, transaction, tx } = createTransactionMocks();
    const renewalTransaction = new PrismaRenewalTransaction(prisma as never);

    await expect(renewalTransaction.completeRenewal(input)).resolves.toEqual({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt,
      cancelAtPeriodEnd: false,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        id: input.subscriptionId,
        userId: input.userId,
        OR: [
          { status: 'PAST_DUE' },
          { status: 'CANCELLED' },
          { status: 'EXPIRED' },
          {
            status: 'ACTIVE',
            expiresAt: { lte: startedAt },
          },
        ],
      },
      data: {
        status: 'ACTIVE',
        startedAt,
        expiresAt,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
      },
    });
    expect(tx.paymentLog.create).toHaveBeenCalledWith({
      data: {
        userId: input.userId,
        subscriptionId: input.subscriptionId,
        amount: 99,
        currency: 'MXN',
        status: 'SUCCEEDED',
        paymentDate: startedAt,
        transactionId: 'transaction-id',
      },
    });
    expect(tx.paymentNotification.create).toHaveBeenCalledWith({
      data: {
        subscriptionId: input.subscriptionId,
        eventType: 'PAYMENT_SUCCEEDED',
        payload: {
          operation: 'RENEW',
          userId: input.userId,
          subscriptionId: input.subscriptionId,
          transactionId: 'transaction-id',
          amount: 99,
          currency: 'MXN',
          occurredAt: startedAt.toISOString(),
        },
      },
    });
    expect(tx.userAccess.upsert).toHaveBeenCalledWith({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        hasPremiumAccess: true,
        validUntil: expiresAt,
      },
      update: {
        hasPremiumAccess: true,
        validUntil: expiresAt,
      },
    });
    expect(tx.idempotencyKey.update).toHaveBeenCalledWith({
      where: {
        id: input.idempotencyId,
        userId: input.userId,
        operation: 'RENEW',
        status: 'PROCESSING',
      },
      data: {
        status: 'COMPLETED',
        resourceId: input.subscriptionId,
        responseStatus: 200,
        responseBody: {
          subscriptionId: input.subscriptionId,
          status: 'ACTIVE',
          expiresAt: expiresAt.toISOString(),
          cancelAtPeriodEnd: false,
        },
      },
    });
  });

  it('resumes a scheduled cancellation without creating payment records', async () => {
    const { prisma, tx } = createTransactionMocks();
    const renewalTransaction = new PrismaRenewalTransaction(prisma as never);

    await renewalTransaction.completeRenewal({
      ...input,
      startedAt: new Date('2026-05-13T10:01:00.000Z'),
      payment: null,
    });

    expect(tx.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          cancelAtPeriodEnd: true,
          expiresAt: { gt: validatedAt },
        }) as unknown,
      }),
    );
    expect(tx.paymentLog.create).not.toHaveBeenCalled();
    expect(tx.paymentNotification.create).not.toHaveBeenCalled();
    expect(tx.userAccess.upsert).toHaveBeenCalledTimes(1);
    expect(tx.idempotencyKey.update).toHaveBeenCalledTimes(1);
  });

  it('propagates a payment log failure before writing the outbox or access', async () => {
    const { prisma, tx } = createTransactionMocks();
    const error = new Error('payment log failed');
    tx.paymentLog.create.mockRejectedValue(error);
    const renewalTransaction = new PrismaRenewalTransaction(prisma as never);

    await expect(renewalTransaction.completeRenewal(input)).rejects.toBe(error);
    expect(tx.paymentNotification.create).not.toHaveBeenCalled();
    expect(tx.userAccess.upsert).not.toHaveBeenCalled();
    expect(tx.idempotencyKey.update).not.toHaveBeenCalled();
  });
});
