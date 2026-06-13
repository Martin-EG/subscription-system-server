export class InvalidPlanForCheckoutError extends Error {
  constructor() {
    super('InvalidPlanForCheckout');
    this.name = 'InvalidPlanForCheckoutError';
  }
}
