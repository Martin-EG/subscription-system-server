import type { PaymentLog } from '../../domain/entities/payment-log.js';
import { NotImplementedError } from '../../domain/errors/not-implemented.error.js';

export class GetPaymentLogsUseCase {
  execute(_userId?: string): Promise<PaymentLog[]> {
    return Promise.reject(new NotImplementedError('Payment log queries'));
  }
}
