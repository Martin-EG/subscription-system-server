export type IdempotencyOperation = 'CHECKOUT' | 'RENEW' | 'CANCEL';

export type IdempotencyStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyKey {
  id: string;
  key: string;
  userId: string;
  operation: IdempotencyOperation;
  requestHash: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: unknown;
  resourceId: string | null;
  createdAt: Date;
  expiresAt: Date;
}
