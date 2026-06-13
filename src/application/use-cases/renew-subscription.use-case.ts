import { createHash } from 'node:crypto';
import type { RenewSubscriptionInput, SubscriptionOutput } from '../dtos';
import type { SubscriptionRepository } from '../ports';
import { ConflictError, NotFoundError } from '../../domain/errors';
import type { BillingPeriod } from '../../generated/prisma/enums';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function addBillingPeriod(date: Date, billingPeriod: BillingPeriod): Date {
  const result = new Date(date);
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);

  if (billingPeriod === 'MONTHLY') {
    result.setUTCMonth(result.getUTCMonth() + 1);
  } else {
    result.setUTCFullYear(result.getUTCFullYear() + 1);
  }

  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));

  return result;
}

export class RenewSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: RenewSubscriptionInput): Promise<SubscriptionOutput> {
    const subscription = await this.subscriptionRepository.findRenewableByUserId(input.userId);

    if (!subscription) {
      throw new NotFoundError('Subscription');
    }

    if (!subscription.billingPeriod) {
      throw new ConflictError('A free subscription cannot be renewed');
    }

    const isScheduledForCancellation =
      subscription.status === 'ACTIVE' && subscription.cancelAtPeriodEnd;
    const now = this.now();
    const resumesCurrentPeriod =
      isScheduledForCancellation && subscription.expiresAt !== null && subscription.expiresAt > now;
    const startedAt = resumesCurrentPeriod ? subscription.startedAt : now;
    const expiresAt =
      resumesCurrentPeriod && subscription.expiresAt
        ? subscription.expiresAt
        : addBillingPeriod(now, subscription.billingPeriod);
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          subscriptionId: subscription.subscriptionId,
          paymentMethod: input.paymentMethod,
        }),
      )
      .digest('hex');

    return this.subscriptionRepository.renew({
      subscriptionId: subscription.subscriptionId,
      userId: input.userId,
      startedAt,
      expiresAt,
      requestHash,
      idempotencyKey: input.idempotencyKey,
      idempotencyExpiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
    });
  }
}
