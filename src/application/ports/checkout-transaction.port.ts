import { CompleteCheckoutInput, CompleteCheckoutResult } from "../dtos";


export interface CheckoutTransactionPort {
  completeCheckout(input: CompleteCheckoutInput): Promise<CompleteCheckoutResult>;
}