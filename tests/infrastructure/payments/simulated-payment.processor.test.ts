import { SimulatedPaymentProcessor } from '../../../src/infrastructure/payments/simulated-payment.processor';

describe('SimulatedPaymentProcessor', () => {
  const processedAt = new Date('2026-06-13T12:00:00.000Z');

  const baseInput = {
    userId: 'user-id',
    amount: 99,
    currency: 'MXN',
    paymentMethod: 'simulated-card',
    idempotencyKey: 'checkout-key',
  };

  it('approves a simulated payment', async () => {
    const processor = new SimulatedPaymentProcessor(
      () => 'transaction-id',
      () => processedAt,
    );

    await expect(processor.process(baseInput)).resolves.toEqual({
      transactionId: 'transaction-id',
      status: 'SUCCEEDED',
      processedAt,
    });
  });

  it('declines the reserved simulated payment method', async () => {
    const processor = new SimulatedPaymentProcessor(
      () => 'transaction-id',
      () => processedAt,
    );

    await expect(
      processor.process({
        ...baseInput,
        paymentMethod: 'simulated-declined',
      }),
    ).resolves.toEqual({
      transactionId: 'transaction-id',
      status: 'DECLINED',
      processedAt,
    });
  });
});
