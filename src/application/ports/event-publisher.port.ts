export interface EventPublisher {
  publish<TPayload>(topic: string, payload: TPayload): Promise<void>;
}
