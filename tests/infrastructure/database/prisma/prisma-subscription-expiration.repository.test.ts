jest.mock('../../../../src/generated/prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
  },
}));

import { PrismaSubscriptionExpirationRepository } from '../../../../src/infrastructure/database/prisma/prisma-subscription-expiration.repository';

describe('PrismaSubscriptionExpirationRepository', () => {
  const now = new Date('2026-06-13T12:00:00.000Z');

  function createPrismaMock(
    expired: Array<{ id: string; user_id: string }>,
    revokedAccess = expired.length,
  ) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue(expired),
      userAccess: {
        updateMany: jest.fn().mockResolvedValue({ count: revokedAccess }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };

    return { prisma, tx };
  }

  it('expires due subscriptions and revokes only access that is also expired', async () => {
    const expired = [
      { id: 'subscription-1', user_id: 'user-1' },
      { id: 'subscription-2', user_id: 'user-2' },
    ];
    const { prisma, tx } = createPrismaMock(expired);
    const repository = new PrismaSubscriptionExpirationRepository(prisma as never);

    await expect(repository.expireDue({ now, limit: 100 })).resolves.toEqual({
      expiredSubscriptions: 2,
      revokedAccess: 2,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userAccess.updateMany).toHaveBeenCalledWith({
      where: {
        userId: {
          in: ['user-1', 'user-2'],
        },
        hasPremiumAccess: true,
        validUntil: {
          not: null,
          lte: now,
        },
      },
      data: {
        hasPremiumAccess: false,
        validUntil: null,
        updatedAt: now,
      },
    });
  });

  it('does not update access when no subscriptions are due', async () => {
    const { prisma, tx } = createPrismaMock([]);
    const repository = new PrismaSubscriptionExpirationRepository(prisma as never);

    await expect(repository.expireDue({ now, limit: 100 })).resolves.toEqual({
      expiredSubscriptions: 0,
      revokedAccess: 0,
    });
    expect(tx.userAccess.updateMany).not.toHaveBeenCalled();
  });

  it('reports the number of access rows actually revoked', async () => {
    const { prisma } = createPrismaMock(
      [
        { id: 'subscription-1', user_id: 'user-1' },
        { id: 'subscription-2', user_id: 'user-2' },
      ],
      1,
    );
    const repository = new PrismaSubscriptionExpirationRepository(prisma as never);

    await expect(repository.expireDue({ now, limit: 100 })).resolves.toEqual({
      expiredSubscriptions: 2,
      revokedAccess: 1,
    });
  });
});
