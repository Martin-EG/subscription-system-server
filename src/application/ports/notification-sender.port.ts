export interface NotificationSender {
  sendPaymentSucceeded(recipient: string, subscriptionId: string): Promise<void>;
}
