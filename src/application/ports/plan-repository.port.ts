import { Plan } from "../../domain/entities";

export interface PlanRepository {
  findById(planId: string): Promise<Plan | null>;
  findAll(): Promise<Plan[]>;
}