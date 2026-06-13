import type { AuthenticatedUser, SubscriptionDetailsOutput } from '../../../src/application/dtos';
import type { SubscriptionRepository } from '../../../src/application/ports';
import { GetSubscriptionByUserIdUseCase } from '../../../src/application/use-cases';
import { ForbiddenError, NotFoundError } from '../../../src/domain/errors';

/* eslint-disable @typescript-eslint/unbound-method -- Jest replaces port methods with mock functions. */

function createRepository() {
  return {
    findByUserId: jest.fn(),
    findRenewableByUserId: jest.fn(),
    findAll: jest.fn(),
    scheduleCancellation: jest.fn(),
    renew: jest.fn(),
  } as jest.Mocked<SubscriptionRepository>;
}

const admin: AuthenticatedUser = {
  id: 'admin-id',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
};
const subscription: SubscriptionDetailsOutput = {
  subscriptionId: 'subscription-id',
  userId: '550e8400-e29b-41d4-a716-446655440000',
  userName: 'Jane Doe',
  userEmail: 'jane@example.com',
  status: 'ACTIVE',
  plan: {
    id: 'plan-id',
    name: 'Premium mensual',
    price: 99,
    currency: 'MXN',
    billingPeriod: 'MONTHLY',
  },
  startedAt: new Date('2026-06-12T00:00:00.000Z'),
  expiresAt: new Date('2026-07-12T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
};

describe('GetSubscriptionByUserIdUseCase', () => {
  it('returns the requested subscription for an admin', async () => {
    const repository = createRepository();
    repository.findByUserId.mockResolvedValue(subscription);
    const useCase = new GetSubscriptionByUserIdUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: admin,
        targetUserId: subscription.userId,
      }),
    ).resolves.toEqual(subscription);
    expect(repository.findByUserId).toHaveBeenCalledWith(subscription.userId);
  });

  it('rejects regular users before querying the repository', async () => {
    const repository = createRepository();
    const useCase = new GetSubscriptionByUserIdUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: { ...admin, role: 'USER' },
        targetUserId: subscription.userId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.findByUserId).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the target user has no subscription', async () => {
    const repository = createRepository();
    repository.findByUserId.mockResolvedValue(null);
    const useCase = new GetSubscriptionByUserIdUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: admin,
        targetUserId: subscription.userId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
