import { ProcessPaymentInput, ProcessPaymentResult } from "../dtos";

export interface PaymentProcessor {
  process(input: ProcessPaymentInput): Promise<ProcessPaymentResult>;
}