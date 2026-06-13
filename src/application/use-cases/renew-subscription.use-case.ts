import { createHash } from 'node:crypto';
import {
  ConflictError,
  IdempotencyConflictError,
  IdempotencyInProgressError,
  NotFoundError,
  PaymentDeclinedError,
} from '../../domain/errors';
import { calculateSubscriptionExpiration } from '../../domain/services';
import type { RenewSubscriptionInput, SubscriptionOutput } from '../dtos';
import type {
  IdempotencyRepository,
  PaymentProcessor,
  RenewalTransactionPort,
  SubscriptionRepository,
} from '../ports';

type Clock = () => Date;
const fiveMinutesInMilliseconds = 5 * 60 * 1000;

export class RenewSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly idempotencyRepository: IdempotencyRepository,
    private readonly paymentProcessor: PaymentProcessor,
    private readonly renewalTransaction: RenewalTransactionPort,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async execute(input: RenewSubscriptionInput): Promise<SubscriptionOutput> {
    const subscription = await this.subscriptionRepository.findRenewableByUserId(input.userId);

    if (!subscription) {
      throw new NotFoundError('Subscription');
    }

    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          subscriptionId: subscription.subscriptionId,
          paymentMethod: input.paymentMethod,
        }),
      )
      .digest('hex');
    const now = this.clock();
    const idempotency = await this.idempotencyRepository.claim({
      key: input.idempotencyKey,
      userId: input.userId,
      operation: 'RENEW',
      requestHash,
      expiresAt: new Date(now.getTime() + fiveMinutesInMilliseconds),
    });

    if (idempotency.outcome === 'REPLAY') {
      return this.parseReplayResponse(idempotency.responseBody);
    }

    if (idempotency.outcome === 'IN_PROGRESS') {
      throw new IdempotencyInProgressError();
    }

    if (idempotency.outcome === 'PAYLOAD_MISMATCH' || idempotency.outcome === 'FAILED') {
      throw new IdempotencyConflictError();
    }

    const idempotencyId = idempotency.record.id;

    try {
      if (!subscription.billingPeriod) {
        throw new ConflictError('A free subscription cannot be renewed');
      }

      const resumesCurrentPeriod =
        subscription.status === 'ACTIVE' &&
        subscription.cancelAtPeriodEnd &&
        subscription.expiresAt !== null &&
        subscription.expiresAt > now;

      if (
        subscription.status === 'ACTIVE' &&
        !resumesCurrentPeriod &&
        (subscription.expiresAt === null || subscription.expiresAt > now)
      ) {
        throw new ConflictError('Subscription is already active');
      }

      if (resumesCurrentPeriod && subscription.expiresAt) {
        return await this.renewalTransaction.completeRenewal({
          userId: input.userId,
          subscriptionId: subscription.subscriptionId,
          idempotencyId,
          validatedAt: now,
          startedAt: subscription.startedAt,
          expiresAt: subscription.expiresAt,
          payment: null,
        });
      }

      const payment = await this.paymentProcessor.process({
        userId: input.userId,
        amount: subscription.price,
        currency: subscription.currency,
        paymentMethod: input.paymentMethod,
        idempotencyKey: input.idempotencyKey,
      });

      if (payment.status === 'DECLINED') {
        throw new PaymentDeclinedError();
      }

      const expiresAt = calculateSubscriptionExpiration(
        payment.processedAt,
        subscription.billingPeriod,
      );

      if (!expiresAt) {
        throw new ConflictError('A free subscription cannot be renewed');
      }

      return await this.renewalTransaction.completeRenewal({
        userId: input.userId,
        subscriptionId: subscription.subscriptionId,
        idempotencyId,
        validatedAt: now,
        startedAt: payment.processedAt,
        expiresAt,
        payment: {
          transactionId: payment.transactionId,
          amount: subscription.price,
          currency: subscription.currency,
          processedAt: payment.processedAt,
        },
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
      !('expiresAt' in response) ||
      !('cancelAtPeriodEnd' in response)
    ) {
      throw new IdempotencyConflictError();
    }

    const replay = response;

    if (
      typeof replay.subscriptionId !== 'string' ||
      replay.status !== 'ACTIVE' ||
      typeof replay.expiresAt !== 'string' ||
      replay.cancelAtPeriodEnd !== false
    ) {
      throw new IdempotencyConflictError();
    }

    return {
      subscriptionId: replay.subscriptionId,
      status: replay.status,
      expiresAt: new Date(replay.expiresAt),
      cancelAtPeriodEnd: replay.cancelAtPeriodEnd,
    };
  }
}
