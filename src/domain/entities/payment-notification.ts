export type PaymentNotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface PaymentNotification {
  id: string;
  subscriptionId: string;
  status: PaymentNotificationStatus;
  retryCount: number;
  lastAttemptAt?: Date;
  createdAt: Date;
}
