import type { SubscriptionStatus } from '../../domain/entities';
import { BillingPeriod } from '../../generated/prisma/enums';

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

export interface SubscriptionPaginationInput {
  page: number;
  limit: number;
}

export interface SubscriptionDetailsOutput {
  subscriptionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: SubscriptionStatus;
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    billingPeriod: BillingPeriod | null;
  }
  startedAt: Date;
  expiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface PaginatedSubscriptionsOutput {
  data: SubscriptionDetailsOutput[];
  page: number;
  limit: number;
  total: number;
}
