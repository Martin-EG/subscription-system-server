import type { EventPublisher } from '../../application/ports/event-publisher.port.js';
import { NotImplementedError } from '../../domain/errors/not-implemented.error.js';

/*
 * implement later:
 * Configure KafkaJS, producers, topics, retry policy and dead-letter handling here.
 */
export class KafkaEventPublisher implements EventPublisher {
  publish<TPayload>(_topic: string, _payload: TPayload): Promise<void> {
    return Promise.reject(new NotImplementedError('Kafka event publisher'));
  }
}
