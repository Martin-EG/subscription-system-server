import type { Plan } from '../../domain/entities';

export interface FindPlanQuery {
  page: number;
  limit: number;
}

export interface PlanSearchResult {
  items: Plan[];
  total: number;
}
export interface PaginatedPlansOutput {
  data: Plan[];
  page: number;
  limit: number;
  total: number;
}
