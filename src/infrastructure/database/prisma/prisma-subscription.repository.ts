import type { SubscriptionRepository } from '../../../application/ports/subscription-repository.port.js';
import type { Subscription } from '../../../domain/entities/subscription.js';
import { NotImplementedError } from '../../../domain/errors/not-implemented.error.js';

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  findById(_id: string): Promise<Subscription | null> {
    return Promise.reject(new NotImplementedError('Prisma subscription repository'));
  }

  findByUserId(_userId: string): Promise<Subscription[]> {
    return Promise.reject(new NotImplementedError('Prisma subscription repository'));
  }

  save(_subscription: Subscription): Promise<void> {
    return Promise.reject(new NotImplementedError('Prisma subscription repository'));
  }
}
