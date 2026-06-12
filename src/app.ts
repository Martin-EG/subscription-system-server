import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './presentation/http/middlewares/error-handler.middleware.js';
import { openApiDocument } from './presentation/http/openapi.js';
import { healthRouter } from './presentation/http/routes/health.routes.js';
import { paymentRouter } from './presentation/http/routes/payment.routes.js';
import { subscriptionRouter } from './presentation/http/routes/subscription.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use('/health', healthRouter);
  app.use('/api/v1/subscriptions', subscriptionRouter);
  app.use('/api/v1/payments', paymentRouter);
  app.use(errorHandler);

  return app;
}
