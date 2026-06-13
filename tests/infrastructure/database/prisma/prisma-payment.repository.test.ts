import { PrismaPaymentRepository } from '../../../../src/infrastructure/database/prisma/prisma-payment.repository';

describe('PrismaPaymentRepository', () => {
  const paymentDate = new Date('2026-06-13T12:00:00.000Z');
  const persistedPayment = {
    id: 'payment-id',
    userId: 'user-id',
    subscriptionId: 'subscription-id',
    amount: {
      toNumber: () => 99,
    },
    currency: 'MXN',
    status: 'SUCCEEDED',
    paymentDate,
    transactionId: 'transaction-id',
  };

  it('returns payment history ordered by newest first', async () => {
    const findMany = jest.fn().mockResolvedValue([persistedPayment]);
    const prisma = {
      paymentLog: {
        findMany,
      },
    };
    const repository = new PrismaPaymentRepository(prisma as never);

    await expect(repository.findByUserId('user-id')).resolves.toEqual([
      {
        ...persistedPayment,
        amount: 99,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
      },
      orderBy: {
        paymentDate: 'desc',
      },
    });
  });

  it('persists a payment log', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      paymentLog: {
        create,
      },
    };
    const repository = new PrismaPaymentRepository(prisma as never);
    const payment = {
      id: 'payment-id',
      userId: 'user-id',
      subscriptionId: 'subscription-id',
      amount: 99,
      currency: 'MXN',
      status: 'SUCCEEDED',
      paymentDate,
      transactionId: 'transaction-id',
    };

    await expect(repository.save(payment)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledWith({
      data: payment,
    });
  });
});
