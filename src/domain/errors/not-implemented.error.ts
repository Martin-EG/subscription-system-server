export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented`);
    this.name = 'NotImplementedError';
  }
}
