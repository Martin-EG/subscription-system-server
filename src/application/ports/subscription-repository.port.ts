import type { Subscription } from '../../domain/entities';

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  findByUserId(userId: string): Promise<Subscription[]>;
  save(subscription: Subscription): Promise<void>;
}
