import type { CheckoutSubscriptionInput, SubscriptionOutput } from '../dtos/subscription.dto.js';
import { NotImplementedError } from '../../domain/errors/not-implemented.error.js';

export class CheckoutSubscriptionUseCase {
  execute(_input: CheckoutSubscriptionInput): Promise<SubscriptionOutput> {
    return Promise.reject(new NotImplementedError('Subscription checkout'));
  }
}
