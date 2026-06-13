import type { PaymentLog } from '../../domain/entities';

export interface FindPaymentsQuery {
  page: number;
  limit: number;
}

export interface PaymentsSearchResult {
  items: PaymentLog[];
  total: number;
}

export interface PaginatedPaymentsOutput {
  data: PaymentLog[];
  page: number;
  limit: number;
  total: number;
}
