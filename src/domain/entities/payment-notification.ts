export type PaymentNotificationStatus = 'SENT' | 'PENDING' | 'FAILED';

export interface PaymentNotification {
  id: string;
  subscriptionId: string;
  status: PaymentNotificationStatus;
  retryCount: number;
  lastAttemptAt?: Date;
  createdAt: Date;
}
