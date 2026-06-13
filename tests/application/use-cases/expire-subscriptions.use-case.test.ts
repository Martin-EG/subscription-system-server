/* eslint-disable @typescript-eslint/unbound-method */
import { ExpireSubscriptionsUseCase } from '../../../src/application/use-cases';
import type { SubscriptionExpirationPort } from '../../../src/application/ports';

describe('ExpireSubscriptionsUseCase', () => {
  it('expires a configured batch using the current time', async () => {
    const now = new Date('2026-06-13T12:00:00.000Z');
    const expiration: jest.Mocked<SubscriptionExpirationPort> = {
      expireDue: jest.fn().mockResolvedValue({
        expiredSubscriptions: 2,
        revokedAccess: 2,
      }),
    };
    const useCase = new ExpireSubscriptionsUseCase(expiration, 100, () => now);

    await expect(useCase.execute()).resolves.toEqual({
      expiredSubscriptions: 2,
      revokedAccess: 2,
    });
    expect(expiration.expireDue).toHaveBeenCalledWith({
      now,
      limit: 100,
    });
  });
});
