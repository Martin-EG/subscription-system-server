export interface PendingPaymentNotification {
  id: string;
  subscriptionId: string;
  eventType: string;
  payload: unknown;
  retryCount: number;
}

export interface PaymentNotificationRepository {
  claimPending(limit: number): Promise<PendingPaymentNotification[]>;
  markSent(id: string): Promise<void>;
  scheduleRetry(id: string, nextAttemptAt: Date, maxRetries: number): Promise<void>;
}
