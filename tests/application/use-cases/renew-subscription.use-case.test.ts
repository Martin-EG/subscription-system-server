import type {
  IdempotencyRepository,
  PaymentProcessor,
  RenewalTransactionPort,
  SubscriptionRepository,
} from '../../../src/application/ports';
import { RenewSubscriptionUseCase } from '../../../src/application/use-cases';
import {
  ConflictError,
  IdempotencyConflictError,
  PaymentDeclinedError,
} from '../../../src/domain/errors';

/* eslint-disable @typescript-eslint/unbound-method -- Jest replaces port methods with mock functions. */

function createDependencies() {
  const subscriptionRepository = {
    findCurrentByUserId: jest.fn(),
    findRenewableByUserId: jest.fn(),
    findAll: jest.fn(),
    scheduleCancellation: jest.fn(),
    renew: jest.fn(),
    save: jest.fn(),
  } as jest.Mocked<SubscriptionRepository>;
  const idempotencyRepository: jest.Mocked<IdempotencyRepository> = {
    claim: jest.fn().mockResolvedValue({
      outcome: 'CLAIMED',
      record: {
        id: 'idempotency-id',
        key: 'renew-request-1',
        userId: 'user-id',
        operation: 'RENEW',
        requestHash: 'request-hash',
        status: 'PROCESSING',
        responseStatus: null,
        responseBody: null,
        resourceId: null,
        createdAt: new Date('2026-06-13T10:00:00.000Z'),
        expiresAt: new Date('2026-06-13T10:05:00.000Z'),
      },
    }),
    markFailed: jest.fn(),
  };
  const paymentProcessor: jest.Mocked<PaymentProcessor> = {
    process: jest.fn().mockResolvedValue({
      transactionId: 'transaction-id',
      status: 'SUCCEEDED',
      processedAt: new Date('2026-06-13T10:01:00.000Z'),
    }),
  };
  const renewalTransaction: jest.Mocked<RenewalTransactionPort> = {
    completeRenewal: jest.fn().mockResolvedValue({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt: new Date('2026-07-13T10:01:00.000Z'),
      cancelAtPeriodEnd: false,
    }),
  };

  return {
    subscriptionRepository,
    idempotencyRepository,
    paymentProcessor,
    renewalTransaction,
  };
}

const input = {
  userId: 'user-id',
  paymentMethod: 'pm_test',
  idempotencyKey: 'renew-request-1',
};
const subscription = {
  subscriptionId: 'subscription-id',
  userId: 'user-id',
  planId: 'monthly-plan-id',
  status: 'CANCELLED' as const,
  startedAt: new Date('2026-05-31T10:30:00.000Z'),
  expiresAt: new Date('2026-06-30T10:30:00.000Z'),
  cancelAtPeriodEnd: false,
  billingPeriod: 'MONTHLY' as const,
  price: 99,
  currency: 'MXN',
};

describe('RenewSubscriptionUseCase', () => {
  const now = new Date('2026-06-13T10:00:00.000Z');

  it('charges and completes a paid renewal', async () => {
    const dependencies = createDependencies();
    dependencies.subscriptionRepository.findRenewableByUserId.mockResolvedValue(subscription);
    const useCase = new RenewSubscriptionUseCase(
      dependencies.subscriptionRepository,
      dependencies.idempotencyRepository,
      dependencies.paymentProcessor,
      dependencies.renewalTransaction,
      () => now,
    );

    await expect(useCase.execute(input)).resolves.toMatchObject({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
    });
    expect(dependencies.idempotencyRepository.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        key: input.idempotencyKey,
        operation: 'RENEW',
        userId: input.userId,
      }),
    );
    expect(dependencies.paymentProcessor.process).toHaveBeenCalledWith({
      userId: input.userId,
      amount: 99,
      currency: 'MXN',
      paymentMethod: input.paymentMethod,
      idempotencyKey: input.idempotencyKey,
    });
    expect(dependencies.renewalTransaction.completeRenewal).toHaveBeenCalledWith({
      userId: input.userId,
      subscriptionId: subscription.subscriptionId,
      idempotencyId: 'idempotency-id',
      validatedAt: now,
      startedAt: new Date('2026-06-13T10:01:00.000Z'),
      expiresAt: new Date('2026-07-13T10:01:00.000Z'),
      payment: {
        transactionId: 'transaction-id',
        amount: 99,
        currency: 'MXN',
        processedAt: new Date('2026-06-13T10:01:00.000Z'),
      },
    });
  });

  it('undoes a scheduled cancellation without charging or extending the period', async () => {
    const dependencies = createDependencies();
    dependencies.subscriptionRepository.findRenewableByUserId.mockResolvedValue({
      ...subscription,
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
      expiresAt: new Date('2026-06-30T10:30:00.000Z'),
    });
    const useCase = new RenewSubscriptionUseCase(
      dependencies.subscriptionRepository,
      dependencies.idempotencyRepository,
      dependencies.paymentProcessor,
      dependencies.renewalTransaction,
      () => now,
    );

    await useCase.execute(input);

    expect(dependencies.paymentProcessor.process).not.toHaveBeenCalled();
    expect(dependencies.renewalTransaction.completeRenewal).toHaveBeenCalledWith(
      expect.objectContaining({
        startedAt: subscription.startedAt,
        expiresAt: subscription.expiresAt,
        payment: null,
      }),
    );
  });

  it('allows an expired subscription to start a new paid period', async () => {
    const dependencies = createDependencies();
    dependencies.subscriptionRepository.findRenewableByUserId.mockResolvedValue({
      ...subscription,
      status: 'EXPIRED',
    });
    const useCase = new RenewSubscriptionUseCase(
      dependencies.subscriptionRepository,
      dependencies.idempotencyRepository,
      dependencies.paymentProcessor,
      dependencies.renewalTransaction,
      () => now,
    );

    await expect(useCase.execute(input)).resolves.toBeDefined();
    expect(dependencies.paymentProcessor.process).toHaveBeenCalledTimes(1);
  });

  it('marks the idempotency record as failed when payment is declined', async () => {
    const dependencies = createDependencies();
    dependencies.subscriptionRepository.findRenewableByUserId.mockResolvedValue(subscription);
    dependencies.paymentProcessor.process.mockResolvedValue({
      transactionId: 'declined-transaction',
      status: 'DECLINED',
      processedAt: now,
    });
    const useCase = new RenewSubscriptionUseCase(
      dependencies.subscriptionRepository,
      dependencies.idempotencyRepository,
      dependencies.paymentProcessor,
      dependencies.renewalTransaction,
      () => now,
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(PaymentDeclinedError);
    expect(dependencies.idempotencyRepository.markFailed).toHaveBeenCalledWith('idempotency-id');
    expect(dependencies.renewalTransaction.completeRenewal).not.toHaveBeenCalled();
  });

  it('replays a completed renewal without charging again', async () => {
    const dependencies = createDependencies();
    dependencies.subscriptionRepository.findRenewableByUserId.mockResolvedValue({
      ...subscription,
      status: 'ACTIVE',
    });
    dependencies.idempotencyRepository.claim.mockResolvedValue({
      outcome: 'REPLAY',
      responseStatus: 200,
      responseBody: {
        subscriptionId: 'subscription-id',
        status: 'ACTIVE',
        expiresAt: '2026-07-13T10:01:00.000Z',
        cancelAtPeriodEnd: false,
      },
    });
    const useCase = new RenewSubscriptionUseCase(
      dependencies.subscriptionRepository,
      dependencies.idempotencyRepository,
      dependencies.paymentProcessor,
      dependencies.renewalTransaction,
      () => now,
    );

    await expect(useCase.execute(input)).resolves.toEqual({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt: new Date('2026-07-13T10:01:00.000Z'),
      cancelAtPeriodEnd: false,
    });
    expect(dependencies.paymentProcessor.process).not.toHaveBeenCalled();
  });

  it('rejects an active subscription without scheduled cancellation', async () => {
    const dependencies = createDependencies();
    dependencies.subscriptionRepository.findRenewableByUserId.mockResolvedValue({
      ...subscription,
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
      expiresAt: new Date('2026-07-13T10:00:00.000Z'),
    });
    const useCase = new RenewSubscriptionUseCase(
      dependencies.subscriptionRepository,
      dependencies.idempotencyRepository,
      dependencies.paymentProcessor,
      dependencies.renewalTransaction,
      () => now,
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(ConflictError);
    expect(dependencies.idempotencyRepository.markFailed).toHaveBeenCalledWith('idempotency-id');
    expect(dependencies.paymentProcessor.process).not.toHaveBeenCalled();
  });

  it('rejects a reused key with a different payload', async () => {
    const dependencies = createDependencies();
    dependencies.subscriptionRepository.findRenewableByUserId.mockResolvedValue(subscription);
    dependencies.idempotencyRepository.claim.mockResolvedValue({
      outcome: 'PAYLOAD_MISMATCH',
    });
    const useCase = new RenewSubscriptionUseCase(
      dependencies.subscriptionRepository,
      dependencies.idempotencyRepository,
      dependencies.paymentProcessor,
      dependencies.renewalTransaction,
      () => now,
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(dependencies.paymentProcessor.process).not.toHaveBeenCalled();
  });
});
