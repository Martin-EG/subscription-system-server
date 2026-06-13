import type { Plan } from "../../domain/entities";

export interface FindPlanQuery {
  page: number;
  limit: number;
}

export interface PlanSearchResult {
  items: Plan[];
  total: number;
}

export interface PlanRepository {
  findById(planId: string): Promise<Plan | null>;
  findAll(query: FindPlanQuery): Promise<PlanSearchResult>;
}