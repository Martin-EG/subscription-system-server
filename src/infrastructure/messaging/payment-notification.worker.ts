import type { PublishPaymentNotificationsResult } from '../../application/use-cases';

interface PublishPaymentNotifications {
  execute(): Promise<PublishPaymentNotificationsResult>;
}

interface PaymentNotificationWorkerOptions {
  pollIntervalMs: number;
  onError?: (error: unknown) => void;
}

export class PaymentNotificationWorker {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = true;

  constructor(
    private readonly publishNotifications: PublishPaymentNotifications,
    private readonly options: PaymentNotificationWorkerOptions,
  ) {}

  start(): void {
    if (!this.stopped) {
      return;
    }

    this.stopped = false;
    void this.run();
  }

  async stop(): Promise<void> {
    this.stopped = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  private async run(): Promise<void> {
    if (this.stopped || this.running) {
      return;
    }

    this.running = true;

    try {
      await this.publishNotifications.execute();
    } catch (error) {
      this.options.onError?.(error);
    } finally {
      this.running = false;
    }

    if (!this.stopped) {
      this.timer = setTimeout(() => void this.run(), this.options.pollIntervalMs);
    }
  }
}
