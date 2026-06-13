import { randomUUID } from 'node:crypto';

import type {
  PaymentProcessor,
  ProcessPaymentInput,
  ProcessPaymentResult,
} from '../../application/ports';

type TransactionIdFactory = () => string;
type Clock = () => Date;

export class SimulatedPaymentProcessor implements PaymentProcessor {
  constructor(
    private readonly transactionIdFactory: TransactionIdFactory = randomUUID,
    private readonly clock: Clock = () => new Date(),
  ) {}

  process(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
    // Token reservado para simular un pago rechazado.
    if (input.paymentMethod === 'simulated-declined') {
      return Promise.resolve({
        transactionId: this.transactionIdFactory(),
        status: 'DECLINED',
        processedAt: this.clock(),
      });
    }

    return Promise.resolve({
      transactionId: this.transactionIdFactory(),
      status: 'SUCCEEDED',
      processedAt: this.clock(),
    });
  }
}
