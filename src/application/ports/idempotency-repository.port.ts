import { ClaimIdempotencyInput, ClaimIdempotencyResult } from "../dtos";

export interface IdempotencyRepository {
  claim(input: ClaimIdempotencyInput): Promise<ClaimIdempotencyResult>;
  markFailed(idempotencyId: string): Promise<void>;
}