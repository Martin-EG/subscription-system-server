import type { Subscription } from '../../domain/entities';
import { SubscriptionDetailsOutput } from '../dtos';

export interface FindSubscriptionQuery {
  page: number;
  limit: number;
}

export interface SubscriptionSearchResult {
  items: SubscriptionDetailsOutput[];
  total: number;
}

export interface SubscriptionRepository {
  findCurrentByUserId(userId: string): Promise<SubscriptionDetailsOutput | null>;
  findAll(query: FindSubscriptionQuery): Promise<SubscriptionSearchResult>;
  save(subscription: Subscription): Promise<void>;
}
