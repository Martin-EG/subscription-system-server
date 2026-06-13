import type { EventPublisher, PaymentNotificationRepository } from '../ports';

export interface PublishPaymentNotificationsResult {
  claimed: number;
  sent: number;
  failed: number;
}

interface Options {
  topic: string;
  batchSize: number;
  maxRetries: number;
}

type Clock = () => Date;

export class PublishPaymentNotificationsUseCase {
  constructor(
    private readonly repository: PaymentNotificationRepository,
    private readonly publisher: EventPublisher,
    private readonly options: Options,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async execute(): Promise<PublishPaymentNotificationsResult> {
    const notifications = await this.repository.claimPending(this.options.batchSize);
    const result = {
      claimed: notifications.length,
      sent: 0,
      failed: 0,
    };

    for (const notification of notifications) {
      try {
        await this.publisher.publish({
          topic: this.options.topic,
          payload: notification.payload,
          key: notification.subscriptionId,
          headers: {
            'event-id': notification.id,
            'event-type': notification.eventType,
          },
        });

        await this.repository.markSent(notification.id);
        result.sent += 1;
      } catch {
        await this.repository.scheduleRetry(
          notification.id,
          this.calculateNextAttempt(notification.retryCount),
          this.options.maxRetries,
        );

        result.failed += 1;
      }
    }

    return result;
  }

  private calculateNextAttempt(retryCount: number): Date {
    const baseDelay = 60_000;
    const maxDelay = 3_600_000;
    const delay = Math.min(baseDelay * 2 ** retryCount, maxDelay);

    return new Date(this.clock().getTime() + delay);
  }
}
