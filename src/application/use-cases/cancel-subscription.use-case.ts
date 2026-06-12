import type { SubscriptionOutput } from '../dtos';
import { NotImplementedError } from '../../domain/errors';

export class CancelSubscriptionUseCase {
  execute(_userId: string): Promise<SubscriptionOutput> {
    return Promise.reject(new NotImplementedError('Subscription cancellation'));
  }
}
