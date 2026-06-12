import type { PaymentLog } from '../../domain/entities';
import { NotImplementedError } from '../../domain/errors';

export class GetPaymentLogsUseCase {
  execute(_userId?: string): Promise<PaymentLog[]> {
    return Promise.reject(new NotImplementedError('Payment log queries'));
  }
}
