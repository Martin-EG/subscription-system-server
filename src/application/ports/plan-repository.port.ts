import type { Plan } from "../../domain/entities";
import type { FindPlanQuery, PlanSearchResult } from "../dtos";

export interface PlanRepository {
  findById(planId: string): Promise<Plan | null>;
  findAll(query: FindPlanQuery): Promise<PlanSearchResult>;
}