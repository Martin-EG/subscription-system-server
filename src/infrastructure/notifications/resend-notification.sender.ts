import type { NotificationSender } from '../../application/ports/notification-sender.port.js';
import { NotImplementedError } from '../../domain/errors/not-implemented.error.js';

/*
 * implement later:
 * Configure the Resend client, templates and payment notification delivery here.
 */
export class ResendNotificationSender implements NotificationSender {
  sendPaymentSucceeded(_recipient: string, _subscriptionId: string): Promise<void> {
    return Promise.reject(new NotImplementedError('Resend notification sender'));
  }
}
