import type { ClaimIdempotencyInput, ClaimIdempotencyResult } from "../dtos";

export interface IdempotencyRepository {
  claim(input: ClaimIdempotencyInput): Promise<ClaimIdempotencyResult>;
  markFailed(id: string): Promise<void>;
}