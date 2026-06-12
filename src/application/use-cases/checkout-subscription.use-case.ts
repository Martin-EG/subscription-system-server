import type { CheckoutSubscriptionInput, SubscriptionOutput } from '../dtos';
import { NotImplementedError } from '../../domain/errors';

export class CheckoutSubscriptionUseCase {
  execute(_input: CheckoutSubscriptionInput): Promise<SubscriptionOutput> {
    return Promise.reject(new NotImplementedError('Subscription checkout'));
  }
}
