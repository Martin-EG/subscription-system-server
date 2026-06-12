import type { PaymentLog } from '../../domain/entities/payment-log.js';

export interface PaymentRepository {
  findByUserId(userId: string): Promise<PaymentLog[]>;
  save(payment: PaymentLog): Promise<void>;
}
