import type { ExpireDueSubscriptionsResult, SubscriptionExpirationPort } from '../ports';

type Clock = () => Date;

export class ExpireSubscriptionsUseCase {
  constructor(
    private readonly expiration: SubscriptionExpirationPort,
    private readonly batchSize: number,
    private readonly clock: Clock = () => new Date(),
  ) {}

  execute(): Promise<ExpireDueSubscriptionsResult> {
    return this.expiration.expireDue({
      now: this.clock(),
      limit: this.batchSize,
    });
  }
}
