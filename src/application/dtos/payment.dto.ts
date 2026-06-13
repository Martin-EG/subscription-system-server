export interface ProcessPaymentInput {
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  idempotencyKey: string;
}

export interface ProcessPaymentResult {
  transactionId: string;
  status: 'SUCCEEDED' | 'DECLINED';
  processedAt: Date;
}