import type { CompleteRenewalInput, SubscriptionOutput } from '../dtos';

export interface RenewalTransactionPort {
  completeRenewal(input: CompleteRenewalInput): Promise<SubscriptionOutput>;
}
