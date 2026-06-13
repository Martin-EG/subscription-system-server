export interface PublishEventInput<TPayload> {
  topic: string;
  key: string;
  payload: TPayload;
  headers?: Record<string, string>;
}

export interface EventPublisher {
  publish<TPayload>(event: PublishEventInput<TPayload>): Promise<void>;
  disconnect(): Promise<void>;
}
