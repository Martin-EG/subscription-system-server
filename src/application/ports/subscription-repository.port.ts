import type { Subscription } from '../../domain/entities';
import type { RenewableSubscription, SubscriptionDetailsOutput, SubscriptionOutput } from '../dtos';

export interface FindSubscriptionQuery {
  page: number;
  limit: number;
}

export interface SubscriptionSearchResult {
  items: SubscriptionDetailsOutput[];
  total: number;
}

export interface ScheduleCancellationInput {
  subscriptionId: string;
  userId: string;
  cancelledAt: Date;
}

export interface RenewSubscriptionPersistenceInput {
  subscriptionId: string;
  userId: string;
  startedAt: Date;
  expiresAt: Date;
  requestHash: string;
  idempotencyKey: string;
  idempotencyExpiresAt: Date;
}

export interface SubscriptionRepository {
  findCurrentByUserId(userId: string): Promise<SubscriptionDetailsOutput | null>;
  findRenewableByUserId(userId: string): Promise<RenewableSubscription | null>;
  findAll(query: FindSubscriptionQuery): Promise<SubscriptionSearchResult>;
  scheduleCancellation(input: ScheduleCancellationInput): Promise<SubscriptionOutput>;
  renew(input: RenewSubscriptionPersistenceInput): Promise<SubscriptionOutput>;
  save(subscription: Subscription): Promise<void>;
}
