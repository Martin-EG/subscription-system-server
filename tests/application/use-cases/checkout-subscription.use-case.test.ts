import type { CheckoutSubscriptionInput } from '../../../src/application/dtos';
import type {
  CheckoutTransactionPort,
  IdempotencyRepository,
  PaymentProcessor,
  PlanRepository,
} from '../../../src/application/ports';
import { CheckoutSubscriptionUseCase } from '../../../src/application/use-cases/checkout-subscription.use-case';
import {
  IdempotencyConflictError,
  IdempotencyInProgressError,
  InvalidPlanForCheckoutError,
  NotFoundError,
  PaymentDeclinedError,
} from '../../../src/domain/errors';
import { createCheckoutRequestHash } from '../../../src/domain/services';

/* eslint-disable @typescript-eslint/unbound-method -- Jest replaces these interface methods with bound mock functions. */

describe('CheckoutSubscriptionUseCase', () => {
  const now = new Date('2026-06-13T12:00:00.000Z');
  const processedAt = new Date('2026-06-13T12:01:00.000Z');
  const expiresAt = new Date('2026-07-13T12:01:00.000Z');
  const input: CheckoutSubscriptionInput = {
    userId: 'user-id',
    planId: 'premium-monthly-id',
    paymentMethod: 'simulated-card',
    idempotencyKey: 'checkout-key',
  };
  const premiumPlan = {
    id: input.planId,
    name: 'Premium mensual',
    price: 99,
    currency: 'MXN',
    billingPeriod: 'MONTHLY' as const,
  };
  const idempotencyRecord = {
    id: 'idempotency-id',
    key: input.idempotencyKey,
    userId: input.userId,
    operation: 'CHECKOUT' as const,
    requestHash: createCheckoutRequestHash({
      planId: input.planId,
      paymentMethod: input.paymentMethod,
    }),
    status: 'PROCESSING' as const,
    responseStatus: null,
    responseBody: null,
    resourceId: null,
    createdAt: now,
    expiresAt: new Date('2026-06-13T12:05:00.000Z'),
  };

  function createDependencies() {
    const planRepository: jest.Mocked<PlanRepository> = {
      findById: jest.fn().mockResolvedValue(premiumPlan),
      findAll: jest.fn(),
    };
    const idempotencyRepository: jest.Mocked<IdempotencyRepository> = {
      claim: jest.fn().mockResolvedValue({
        outcome: 'CLAIMED',
        record: idempotencyRecord,
      }),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const paymentProcessor: jest.Mocked<PaymentProcessor> = {
      process: jest.fn().mockResolvedValue({
        transactionId: 'transaction-id',
        status: 'SUCCEEDED',
        processedAt,
      }),
    };
    const checkoutTransaction: jest.Mocked<CheckoutTransactionPort> = {
      completeCheckout: jest.fn().mockResolvedValue({
        subscriptionId: 'subscription-id',
        status: 'ACTIVE',
        expiresAt,
      }),
    };
    const useCase = new CheckoutSubscriptionUseCase(
      planRepository,
      idempotencyRepository,
      paymentProcessor,
      checkoutTransaction,
      () => now,
    );

    return {
      useCase,
      planRepository,
      idempotencyRepository,
      paymentProcessor,
      checkoutTransaction,
    };
  }

  it('completes a premium checkout after a successful payment', async () => {
    const {
      useCase,
      planRepository,
      idempotencyRepository,
      paymentProcessor,
      checkoutTransaction,
    } = createDependencies();

    await expect(useCase.execute(input)).resolves.toEqual({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt,
    });
    expect(idempotencyRepository.claim).toHaveBeenCalledWith({
      key: input.idempotencyKey,
      userId: input.userId,
      operation: 'CHECKOUT',
      requestHash: idempotencyRecord.requestHash,
      expiresAt: new Date('2026-06-13T12:05:00.000Z'),
    });
    expect(planRepository.findById).toHaveBeenCalledWith(input.planId);
    expect(paymentProcessor.process).toHaveBeenCalledWith({
      userId: input.userId,
      amount: premiumPlan.price,
      currency: premiumPlan.currency,
      paymentMethod: input.paymentMethod,
      idempotencyKey: input.idempotencyKey,
    });
    expect(checkoutTransaction.completeCheckout).toHaveBeenCalledWith({
      userId: input.userId,
      planId: premiumPlan.id,
      idempotencyId: idempotencyRecord.id,
      transactionId: 'transaction-id',
      amount: premiumPlan.price,
      currency: premiumPlan.currency,
      startedAt: processedAt,
      expiresAt,
    });
    expect(idempotencyRepository.markFailed).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'an expiration date',
      responseBody: {
        subscriptionId: 'subscription-id',
        status: 'ACTIVE',
        expiresAt: expiresAt.toISOString(),
      },
      expectedExpiresAt: expiresAt,
    },
    {
      name: 'a null expiration',
      responseBody: {
        subscriptionId: 'subscription-id',
        status: 'ACTIVE',
        expiresAt: null,
      },
      expectedExpiresAt: null,
    },
  ])('replays a completed checkout with $name', async ({ responseBody, expectedExpiresAt }) => {
    const {
      useCase,
      idempotencyRepository,
      planRepository,
      paymentProcessor,
      checkoutTransaction,
    } = createDependencies();
    idempotencyRepository.claim.mockResolvedValue({
      outcome: 'REPLAY',
      responseStatus: 201,
      responseBody,
    });

    await expect(useCase.execute(input)).resolves.toEqual({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt: expectedExpiresAt,
    });
    expect(planRepository.findById).not.toHaveBeenCalled();
    expect(paymentProcessor.process).not.toHaveBeenCalled();
    expect(checkoutTransaction.completeCheckout).not.toHaveBeenCalled();
    expect(idempotencyRepository.markFailed).not.toHaveBeenCalled();
  });

  it.each([
    {
      outcome: 'PAYLOAD_MISMATCH' as const,
      error: IdempotencyConflictError,
    },
    {
      outcome: 'FAILED' as const,
      error: IdempotencyConflictError,
    },
    {
      outcome: 'IN_PROGRESS' as const,
      error: IdempotencyInProgressError,
    },
  ])('rejects the $outcome idempotency outcome', async ({ outcome, error }) => {
    const { useCase, idempotencyRepository, planRepository } = createDependencies();
    idempotencyRepository.claim.mockResolvedValue({ outcome });

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(error);
    expect(planRepository.findById).not.toHaveBeenCalled();
    expect(idempotencyRepository.markFailed).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    {
      subscriptionId: 'subscription-id',
      status: 'CANCELLED',
      expiresAt: null,
    },
    {
      subscriptionId: 123,
      status: 'ACTIVE',
      expiresAt: null,
    },
    {
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt: 123,
    },
  ])('rejects an invalid replay response %#', async (responseBody) => {
    const { useCase, idempotencyRepository } = createDependencies();
    idempotencyRepository.claim.mockResolvedValue({
      outcome: 'REPLAY',
      responseStatus: 201,
      responseBody,
    });

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(idempotencyRepository.markFailed).not.toHaveBeenCalled();
  });

  it('marks the operation as failed when the plan does not exist', async () => {
    const { useCase, planRepository, idempotencyRepository, paymentProcessor } =
      createDependencies();
    planRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(NotFoundError);
    expect(idempotencyRepository.markFailed).toHaveBeenCalledWith(idempotencyRecord.id);
    expect(paymentProcessor.process).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'has no price',
      plan: { ...premiumPlan, price: 0 },
    },
    {
      name: 'has no billing period',
      plan: { ...premiumPlan, billingPeriod: null },
    },
  ])('rejects a plan that $name and marks the operation as failed', async ({ plan }) => {
    const { useCase, planRepository, idempotencyRepository, paymentProcessor } =
      createDependencies();
    planRepository.findById.mockResolvedValue(plan);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(InvalidPlanForCheckoutError);
    expect(idempotencyRepository.markFailed).toHaveBeenCalledWith(idempotencyRecord.id);
    expect(paymentProcessor.process).not.toHaveBeenCalled();
  });

  it('marks the operation as failed when payment is declined', async () => {
    const { useCase, paymentProcessor, idempotencyRepository, checkoutTransaction } =
      createDependencies();
    paymentProcessor.process.mockResolvedValue({
      transactionId: 'declined-transaction-id',
      status: 'DECLINED',
      processedAt,
    });

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(PaymentDeclinedError);
    expect(idempotencyRepository.markFailed).toHaveBeenCalledWith(idempotencyRecord.id);
    expect(checkoutTransaction.completeCheckout).not.toHaveBeenCalled();
  });

  it('marks the operation as failed when completing the transaction fails', async () => {
    const { useCase, checkoutTransaction, idempotencyRepository } = createDependencies();
    const error = new Error('database unavailable');
    checkoutTransaction.completeCheckout.mockRejectedValue(error);

    await expect(useCase.execute(input)).rejects.toBe(error);
    expect(idempotencyRepository.markFailed).toHaveBeenCalledWith(idempotencyRecord.id);
  });

  it('propagates a claim failure without attempting to mark an unclaimed operation', async () => {
    const { useCase, idempotencyRepository, planRepository } = createDependencies();
    const error = new Error('idempotency database unavailable');
    idempotencyRepository.claim.mockRejectedValue(error);

    await expect(useCase.execute(input)).rejects.toBe(error);
    expect(planRepository.findById).not.toHaveBeenCalled();
    expect(idempotencyRepository.markFailed).not.toHaveBeenCalled();
  });
});
