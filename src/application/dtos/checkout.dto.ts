export interface CompleteCheckoutInput {
  userId: string;
  planId: string;
  idempotencyId: string;
  transactionId: string;
  amount: number;
  currency: string;
  startedAt: Date;
  expiresAt: Date | null;
}

export interface CompleteCheckoutResult {
  subscriptionId: string;
  status: 'ACTIVE';
  expiresAt: Date | null;
}
