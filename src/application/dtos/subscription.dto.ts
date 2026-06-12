import type { SubscriptionStatus } from '../../domain/entities/subscription.js';

export interface CheckoutSubscriptionInput {
  userId: string;
  planId: string;
  paymentMethod: string;
  idempotencyKey: string;
}

export interface SubscriptionOutput {
  subscriptionId: string;
  status: SubscriptionStatus;
  expiresAt: Date | null;
}

export interface SubscriptionQuery {
  page?: number;
  limit?: number;
  userId?: string;
}
