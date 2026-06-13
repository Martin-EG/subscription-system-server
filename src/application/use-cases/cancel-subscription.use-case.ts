import type { SubscriptionOutput } from '../dtos';
import type { SubscriptionRepository } from '../ports';
import { ConflictError, NotFoundError } from '../../domain/errors';

type Clock = () => Date;

export class CancelSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(userId: string): Promise<SubscriptionOutput> {
    const now = this.now();
    const subscription = await this.subscriptionRepository.findRenewableByUserId(userId);

    if (!subscription) {
      throw new NotFoundError('Subscription');
    }

    if (!subscription.billingPeriod || !subscription.expiresAt) {
      throw new ConflictError('A free subscription cannot be cancelled');
    }

    if (subscription.expiresAt <= now) {
      throw new ConflictError('An expired subscription cannot be cancelled');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new ConflictError('Only an active subscription can be cancelled');
    }

    if (subscription.cancelAtPeriodEnd) {
      return {
        subscriptionId: subscription.subscriptionId,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        cancelAtPeriodEnd: true,
      };
    }

    return this.subscriptionRepository.scheduleCancellation({
      subscriptionId: subscription.subscriptionId,
      userId,
      cancelledAt: now,
    });
  }
}
