import { createHash } from "node:crypto";

interface CheckoutHashInput {
  planId: string;
  paymentMethod: string;
}

type CreateCheckoutRequestHash = (input: CheckoutHashInput) => string;
export const createCheckoutRequestHash: CreateCheckoutRequestHash = ({ planId, paymentMethod }) => {
  const payload = JSON.stringify({ planId, paymentMethod });

  return createHash('sha256').update(payload).digest('hex');
}