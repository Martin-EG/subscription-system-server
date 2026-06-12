import type { SubscriptionQuery } from '../dtos';
import type { Subscription } from '../../domain/entities';
import { NotImplementedError } from '../../domain/errors';

export class GetSubscriptionsUseCase {
  execute(_query: SubscriptionQuery): Promise<Subscription[]> {
    return Promise.reject(new NotImplementedError('Subscription queries'));
  }
}
