export interface ExpireDueSubscriptionsInput {
  now: Date;
  limit: number;
}

export interface ExpireDueSubscriptionsResult {
  expiredSubscriptions: number;
  revokedAccess: number;
}

export interface SubscriptionExpirationPort {
  expireDue(input: ExpireDueSubscriptionsInput): Promise<ExpireDueSubscriptionsResult>;
}
