import type { SubscriptionRepository } from '../../../application/ports';
import type { Subscription } from '../../../domain/entities';
import { NotImplementedError } from '../../../domain/errors';

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
