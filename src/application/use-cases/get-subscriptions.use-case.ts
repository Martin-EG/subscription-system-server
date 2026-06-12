import type { SubscriptionQuery } from '../dtos/subscription.dto.js';
import type { Subscription } from '../../domain/entities/subscription.js';
import { NotImplementedError } from '../../domain/errors/not-implemented.error.js';

export class GetSubscriptionsUseCase {
  execute(_query: SubscriptionQuery): Promise<Subscription[]> {
    return Promise.reject(new NotImplementedError('Subscription queries'));
  }
}
