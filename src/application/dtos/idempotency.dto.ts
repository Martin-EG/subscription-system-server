import type { IdempotencyKey } from '../../domain/entities';

export interface ClaimIdempotencyInput {
  key: string;
  userId: string;
  operation: 'CHECKOUT';
  requestHash: string;
  expiresAt: Date;
}

export type ClaimIdempotencyResult =
  | { outcome: 'CLAIMED'; record: IdempotencyKey }
  | { outcome: 'REPLAY'; responseStatus: number; responseBody: unknown }
  | { outcome: 'IN_PROGRESS' }
  | { outcome: 'PAYLOAD_MISMATCH' }
  | { outcome: 'FAILED' };
