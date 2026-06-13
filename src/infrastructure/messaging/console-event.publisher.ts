import type {
  EventPublisher,
  PublishEventInput,
} from '../../application/ports/event-publisher.port.js';

type LogEvent = (message: string, event: PublishEventInput<unknown>) => void;

export class ConsoleEventPublisher implements EventPublisher {
  constructor(
    private readonly logEvent: LogEvent = (message, event) => console.info(message, event),
  ) {}

  publish<TPayload>(event: PublishEventInput<TPayload>): Promise<void> {
    this.logEvent('External payment notification published', event);
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }
}
