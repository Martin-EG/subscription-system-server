import type { PaymentLog } from '../../domain/entities';
import type { FindPaymentsQuery, PaymentsSearchResult } from '../dtos';

export interface PaymentRepository {
  findByUserId(userId: string): Promise<PaymentLog[]>;
  findAll(input: FindPaymentsQuery): Promise<PaymentsSearchResult>;
  save(payment: PaymentLog): Promise<void>;
}
