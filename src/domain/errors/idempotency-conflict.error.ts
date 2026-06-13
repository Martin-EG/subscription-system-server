export class IdempotencyConflictError extends Error {
  constructor() {
    super('IdempotencyConflict');
    this.name = 'IdempotencyConflictError';
  }
}
