import type { SubscriptionDetailsOutput } from '../../../application/dtos';
import type {
  FindSubscriptionQuery,
  SubscriptionRepository,
  SubscriptionSearchResult,
} from '../../../application/ports';
import type { Subscription } from '../../../domain/entities';
import { NotImplementedError } from '../../../domain/errors';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { SubscriptionStatus } from '../../../generated/prisma/enums';

type SubscriptionWithRelations = Prisma.SubscriptionGetPayload<{
  include: {
    user: true;
    plan: true;
  };
}>;

type MapSubscriptionData = (subscription: SubscriptionWithRelations) => SubscriptionDetailsOutput;
const mapSubscriptionData: MapSubscriptionData = (subscription) => ({
  subscriptionId: subscription.id,
  userId: subscription.userId,
  userEmail: subscription.user.email,
  userName: subscription.user.name,
  status: subscription.status,
  plan: {
    id: subscription.planId,
    name: subscription.plan.name,
    price: subscription.plan.price.toNumber(),
    currency: subscription.plan.currency,
    billingPeriod: subscription.plan.billingPeriod,
  },
  startedAt: subscription.startedAt,
  expiresAt: subscription.expiresAt,
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
});

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCurrentByUserId(userId: string): Promise<SubscriptionDetailsOutput | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
      },
      include: {
        user: true,
        plan: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!subscription) {
      return null;
    }

    return mapSubscriptionData(subscription);
  }

  async findAll({ page, limit }: FindSubscriptionQuery): Promise<SubscriptionSearchResult> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        include: {
          user: true,
          plan: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.subscription.count(),
    ]);

    return {
      items: items.map((item) => mapSubscriptionData(item)),
      total,
    };
  }

  save(_subscription: Subscription): Promise<void> {
    return Promise.reject(new NotImplementedError('Prisma subscription repository'));
  }
}
