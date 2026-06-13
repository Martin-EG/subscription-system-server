export class PaymentDeclinedError extends Error {
  constructor() {
    super('PaymentDeclined');
    this.name = 'PaymentDeclinedError';
  }
}
