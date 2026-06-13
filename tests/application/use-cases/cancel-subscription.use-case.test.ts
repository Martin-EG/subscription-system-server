import type { SubscriptionRepository } from '../../../src/application/ports';
import { CancelSubscriptionUseCase } from '../../../src/application/use-cases';
import { ConflictError, NotFoundError } from '../../../src/domain/errors';

function createRepository(overrides: Partial<SubscriptionRepository> = {}) {
  return {
    findCurrentByUserId: jest.fn(),
    findRenewableByUserId: jest.fn(),
    findAll: jest.fn(),
    scheduleCancellation: jest.fn(),
    renew: jest.fn(),
    save: jest.fn(),
    ...overrides,
  } as jest.Mocked<SubscriptionRepository>;
}

const premiumSubscription = {
  subscriptionId: 'subscription-id',
  userId: 'user-id',
  planId: 'plan-id',
  status: 'ACTIVE' as const,
  startedAt: new Date('2026-06-01T00:00:00.000Z'),
  expiresAt: new Date('2026-07-01T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
  billingPeriod: 'MONTHLY' as const,
  price: 99,
  currency: 'MXN',
};

describe('CancelSubscriptionUseCase', () => {
  it('schedules cancellation without changing the current period', async () => {
    const now = new Date('2026-06-13T12:00:00.000Z');
    const output = {
      subscriptionId: 'subscription-id',
      status: 'ACTIVE' as const,
      expiresAt: premiumSubscription.expiresAt,
      cancelAtPeriodEnd: true,
    };
    const repository = createRepository({
      findRenewableByUserId: jest.fn().mockResolvedValue(premiumSubscription),
      scheduleCancellation: jest.fn().mockResolvedValue(output),
    });

    await expect(
      new CancelSubscriptionUseCase(repository, () => now).execute('user-id'),
    ).resolves.toEqual(output);
    expect(repository.scheduleCancellation.mock.calls[0]?.[0]).toEqual({
      subscriptionId: 'subscription-id',
      userId: 'user-id',
      cancelledAt: now,
    });
  });

  it('is idempotent when cancellation is already scheduled', async () => {
    const repository = createRepository({
      findRenewableByUserId: jest
        .fn()
        .mockResolvedValue({ ...premiumSubscription, cancelAtPeriodEnd: true }),
    });

    await expect(new CancelSubscriptionUseCase(repository).execute('user-id')).resolves.toEqual({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt: premiumSubscription.expiresAt,
      cancelAtPeriodEnd: true,
    });
    expect(repository.scheduleCancellation.mock.calls).toHaveLength(0);
  });

  it('rejects free subscriptions', async () => {
    const repository = createRepository({
      findRenewableByUserId: jest.fn().mockResolvedValue({
        ...premiumSubscription,
        expiresAt: null,
        billingPeriod: null,
        price: 0,
      }),
    });

    await expect(
      new CancelSubscriptionUseCase(repository).execute('user-id'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects missing subscriptions', async () => {
    const repository = createRepository({
      findRenewableByUserId: jest.fn().mockResolvedValue(null),
    });

    await expect(
      new CancelSubscriptionUseCase(repository).execute('user-id'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects an active record whose access period already expired', async () => {
    const repository = createRepository({
      findRenewableByUserId: jest.fn().mockResolvedValue({
        ...premiumSubscription,
        expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      }),
    });

    await expect(
      new CancelSubscriptionUseCase(repository, () => new Date('2026-06-13T00:00:00.000Z')).execute(
        'user-id',
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
