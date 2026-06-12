import type { SubscriptionOutput } from '../dtos/subscription.dto.js';
import { NotImplementedError } from '../../domain/errors/not-implemented.error.js';

export class RenewSubscriptionUseCase {
  execute(_userId: string): Promise<SubscriptionOutput> {
    return Promise.reject(new NotImplementedError('Subscription renewal'));
  }
}
