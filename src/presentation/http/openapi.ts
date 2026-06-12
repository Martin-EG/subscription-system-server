export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Subscription System API',
    version: '0.1.0',
    description: 'Placeholder API. Business operations currently return HTTP 501.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {
    '/health': {
      get: { summary: 'Service health', responses: { '200': { description: 'Healthy' } } },
    },
    '/api/v1/subscriptions/checkout': {
      post: {
        summary: 'Activate a premium subscription',
        responses: { '501': { description: 'Placeholder' } },
      },
    },
    '/api/v1/subscriptions/cancel': {
      patch: {
        summary: 'Cancel the authenticated user subscription',
        responses: { '501': { description: 'Placeholder' } },
      },
    },
    '/api/v1/subscriptions/renew': {
      patch: {
        summary: 'Renew the authenticated user subscription',
        responses: { '501': { description: 'Placeholder' } },
      },
    },
    '/api/v1/subscriptions': {
      get: {
        summary: 'Get subscriptions according to the authenticated user role',
        responses: { '501': { description: 'Placeholder' } },
      },
    },
    '/api/v1/subscriptions/{userId}': {
      get: {
        summary: 'Get a user subscription',
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '501': { description: 'Placeholder' } },
      },
    },
    '/api/v1/payments': {
      get: {
        summary: 'Get payment logs',
        responses: { '501': { description: 'Placeholder' } },
      },
    },
  },
} as const;
