/* eslint-disable @typescript-eslint/unbound-method */
import { PublishPaymentNotificationsUseCase } from '../../../src/application/use-cases';
import type { EventPublisher, PaymentNotificationRepository } from '../../../src/application/ports';

describe('PublishPaymentNotificationsUseCase', () => {
  const notification = {
    id: 'notification-id',
    subscriptionId: 'subscription-id',
    eventType: 'PAYMENT_SUCCEEDED',
    payload: {
      transactionId: 'transaction-id',
    },
    retryCount: 2,
  };
  const now = new Date('2026-06-13T12:00:00.000Z');

  function createDependencies() {
    const repository: jest.Mocked<PaymentNotificationRepository> = {
      claimPending: jest.fn().mockResolvedValue([notification]),
      markSent: jest.fn().mockResolvedValue(undefined),
      scheduleRetry: jest.fn().mockResolvedValue(undefined),
    };
    const publisher: jest.Mocked<EventPublisher> = {
      publish: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new PublishPaymentNotificationsUseCase(
      repository,
      publisher,
      {
        topic: 'payment-succeeded',
        batchSize: 100,
        maxRetries: 5,
      },
      () => now,
    );

    return { publisher, repository, useCase };
  }

  it('publishes claimed notifications and marks them as sent', async () => {
    const { publisher, repository, useCase } = createDependencies();

    await expect(useCase.execute()).resolves.toEqual({
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    expect(repository.claimPending).toHaveBeenCalledWith(100);
    expect(publisher.publish).toHaveBeenCalledWith({
      topic: 'payment-succeeded',
      key: 'subscription-id',
      payload: notification.payload,
      headers: {
        'event-id': 'notification-id',
        'event-type': 'PAYMENT_SUCCEEDED',
      },
    });
    expect(repository.markSent).toHaveBeenCalledWith('notification-id');
    expect(repository.scheduleRetry).not.toHaveBeenCalled();
  });

  it('schedules an exponential retry when publication fails', async () => {
    const { publisher, repository, useCase } = createDependencies();
    publisher.publish.mockRejectedValue(new Error('external service unavailable'));

    await expect(useCase.execute()).resolves.toEqual({
      claimed: 1,
      sent: 0,
      failed: 1,
    });
    expect(repository.markSent).not.toHaveBeenCalled();
    expect(repository.scheduleRetry).toHaveBeenCalledWith(
      'notification-id',
      new Date('2026-06-13T12:04:00.000Z'),
      5,
    );
  });

  it('caps retry delays at one hour', async () => {
    const { publisher, repository, useCase } = createDependencies();
    repository.claimPending.mockResolvedValue([{ ...notification, retryCount: 20 }]);
    publisher.publish.mockRejectedValue(new Error('external service unavailable'));

    await useCase.execute();

    expect(repository.scheduleRetry).toHaveBeenCalledWith(
      'notification-id',
      new Date('2026-06-13T13:00:00.000Z'),
      5,
    );
  });

  it('returns an empty result when no notifications are pending', async () => {
    const { publisher, repository, useCase } = createDependencies();
    repository.claimPending.mockResolvedValue([]);

    await expect(useCase.execute()).resolves.toEqual({
      claimed: 0,
      sent: 0,
      failed: 0,
    });
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
