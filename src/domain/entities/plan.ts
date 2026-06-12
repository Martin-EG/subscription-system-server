export type BillingPeriod = 'MONTHLY' | 'YEARLY';

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: BillingPeriod | null;
}
