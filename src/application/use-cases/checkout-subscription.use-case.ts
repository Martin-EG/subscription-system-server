import {
  IdempotencyConflictError,
  IdempotencyInProgressError,
  InvalidPlanForCheckoutError,
  NotFoundError,
  PaymentDeclinedError,
} from '../../domain/errors';
import { calculateSubscriptionExpiration, createCheckoutRequestHash } from '../../domain/services';
import type { CheckoutSubscriptionInput, SubscriptionOutput } from '../dtos';
import type {
  CheckoutTransactionPort,
  IdempotencyRepository,
  PaymentProcessor,
  PlanRepository,
} from '../ports';

type Clock = () => Date;
const fiveMinutesInMiliseconds = 5 * 60 * 1000;

export class CheckoutSubscriptionUseCase {
  constructor(
    private readonly planRepository: PlanRepository,
    private readonly idempotencyRepository: IdempotencyRepository,
    private readonly paymentProcessor: PaymentProcessor,
    private readonly checkoutTransaction: CheckoutTransactionPort,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async execute(input: CheckoutSubscriptionInput): Promise<SubscriptionOutput> {
    const requestHash = createCheckoutRequestHash({
      planId: input.planId,
      paymentMethod: input.paymentMethod,
    });

    const now = this.clock();
    const idempotency = await this.idempotencyRepository.claim({
      key: input.idempotencyKey,
      userId: input.userId,
      operation: 'CHECKOUT',
      requestHash,
      expiresAt: new Date(now.getTime() + fiveMinutesInMiliseconds),
    });

    if (idempotency.outcome === 'REPLAY') {
      return this.parseReplayResponse(idempotency.responseBody);
    }

    if (idempotency.outcome === 'PAYLOAD_MISMATCH') {
      throw new IdempotencyConflictError();
    }

    if (idempotency.outcome === 'IN_PROGRESS') {
      throw new IdempotencyInProgressError();
    }

    if (idempotency.outcome === 'FAILED') {
      throw new IdempotencyConflictError();
    }

    const idempotencyId = idempotency.record.id;

    try {
      const plan = await this.planRepository.findById(input.planId);

      if (!plan) {
        throw new NotFoundError('Plan');
      }

      if (plan.price <= 0 || plan.billingPeriod === null) {
        throw new InvalidPlanForCheckoutError();
      }

      const payment = await this.paymentProcessor.process({
        userId: input.userId,
        amount: plan.price,
        currency: plan.currency,
        paymentMethod: input.paymentMethod,
        idempotencyKey: input.idempotencyKey,
      });

      if (payment.status === 'DECLINED') {
        throw new PaymentDeclinedError();
      }

      const startedAt = payment.processedAt;
      const expiresAt = calculateSubscriptionExpiration(startedAt, plan.billingPeriod);

      return await this.checkoutTransaction.completeCheckout({
        userId: input.userId,
        planId: plan.id,
        idempotencyId,
        transactionId: payment.transactionId,
        amount: plan.price,
        currency: plan.currency,
        startedAt,
        expiresAt,
      });
    } catch (error) {
      await this.idempotencyRepository.markFailed(idempotencyId);
      throw error;
    }
  }

  private parseReplayResponse(response: unknown): SubscriptionOutput {
    if (
      typeof response !== 'object' ||
      response === null ||
      !('subscriptionId' in response) ||
      !('status' in response) ||
      !('expiresAt' in response)
    ) {
      throw new IdempotencyConflictError();
    }

    const replay = response;

    if (
      typeof replay.subscriptionId !== 'string' ||
      replay.status !== 'ACTIVE' ||
      (replay.expiresAt !== null && typeof replay.expiresAt !== 'string')
    ) {
      throw new IdempotencyConflictError();
    }

    return {
      subscriptionId: replay.subscriptionId,
      status: replay.status,
      expiresAt: replay.expiresAt === null ? null : new Date(replay.expiresAt),
    };
  }
}
