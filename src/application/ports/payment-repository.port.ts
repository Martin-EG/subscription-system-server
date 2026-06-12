import type { PaymentLog } from '../../domain/entities';

export interface PaymentRepository {
  findByUserId(userId: string): Promise<PaymentLog[]>;
  save(payment: PaymentLog): Promise<void>;
}
