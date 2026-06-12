export interface PaymentLog {
  id: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: string;
  paymentDate: Date;
  transactionId: string;
}
