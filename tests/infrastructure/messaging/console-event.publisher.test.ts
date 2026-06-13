import { ConsoleEventPublisher } from '../../../src/infrastructure/messaging/console-event.publisher';

describe('ConsoleEventPublisher', () => {
  it('logs the simulated external event', async () => {
    const logEvent = jest.fn();
    const publisher = new ConsoleEventPublisher(logEvent);
    const event = {
      topic: 'payment-succeeded',
      key: 'subscription-id',
      payload: { transactionId: 'transaction-id' },
    };

    await expect(publisher.publish(event)).resolves.toBeUndefined();

    expect(logEvent).toHaveBeenCalledWith('External payment notification published', event);
    await expect(publisher.disconnect()).resolves.toBeUndefined();
  });
});
