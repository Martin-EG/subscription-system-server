export class IdempotencyInProgressError extends Error {
  constructor() {
    super('IdempotencyInProgress');
    this.name = 'IdempotencyInProgressError';
  }
}
