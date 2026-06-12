export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Subscription System API',
    version: '0.1.0',
    description: 'Placeholder API. Business operations currently return HTTP 501.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      AuthUser: {
        type: 'object',
        required: ['id', 'email', 'name', 'role'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: ['string', 'null'] },
          role: { type: ['string', 'null'], examples: ['USER'] },
        },
      },
      LoginResponse: {
        type: 'object',
        required: ['access_token', 'expires_in', 'user'],
        properties: {
          access_token: { type: 'string', description: 'Supabase JWT access token.' },
          expires_in: { type: 'integer', description: 'Token lifetime in seconds.' },
          user: { $ref: '#/components/schemas/AuthUser' },
        },
      },
      SubscriptionPlan: {
        type: 'object',
        required: ['id', 'name', 'price', 'currency', 'billingPeriod'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          price: { type: 'number', format: 'decimal', examples: [99] },
          currency: { type: 'string', examples: ['MXN'] },
          billingPeriod: {
            type: ['string', 'null'],
            enum: ['MONTHLY', 'YEARLY', null],
          },
        },
      },
      SubscriptionDetails: {
        type: 'object',
        required: [
          'subscriptionId',
          'userId',
          'userName',
          'userEmail',
          'status',
          'plan',
          'startedAt',
          'expiresAt',
          'cancelAtPeriodEnd',
        ],
        properties: {
          subscriptionId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          userName: { type: 'string' },
          userEmail: { type: 'string', format: 'email' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'],
          },
          plan: { $ref: '#/components/schemas/SubscriptionPlan' },
          startedAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: ['string', 'null'], format: 'date-time' },
          cancelAtPeriodEnd: { type: 'boolean' },
        },
      },
      PaginatedSubscriptions: {
        type: 'object',
        required: ['data', 'page', 'limit', 'total'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/SubscriptionDetails' },
          },
          page: { type: 'integer', minimum: 1, examples: [1] },
          limit: { type: 'integer', minimum: 1, maximum: 100, examples: [20] },
          total: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: { summary: 'Service health', responses: { '200': { description: 'Healthy' } } },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Authenticate with email and password',
        description: 'Returns a Supabase JWT and also sets it in the HttpOnly access_token cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authenticated',
            headers: {
              'Set-Cookie': {
                description: 'HttpOnly access_token cookie.',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          '400': { description: 'Invalid request body' },
          '401': { description: 'Invalid credentials' },
        },
      },
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
        summary: 'Get subscription details according to the authenticated user role',
        description:
          'A regular user receives their current subscription. An ADMIN receives all current subscriptions with pagination.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            description: 'Admin pagination page. Defaults to 1.',
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Admin page size. Defaults to 20 and cannot exceed 100.',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Current user subscription or paginated admin result',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/SubscriptionDetails' },
                    { $ref: '#/components/schemas/PaginatedSubscriptions' },
                  ],
                },
              },
            },
          },
          '400': { description: 'Invalid pagination parameters' },
          '401': { description: 'Missing or invalid access token' },
          '404': { description: 'Current user subscription not found' },
        },
      },
    },
    '/api/v1/subscriptions/{userId}': {
      get: {
        summary: 'Get the current subscription for a user',
        description: 'Available only to authenticated users with the ADMIN role.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Current subscription for the requested user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubscriptionDetails' },
              },
            },
          },
          '401': { description: 'Missing or invalid access token' },
          '403': { description: 'The authenticated user is not an admin' },
          '404': { description: 'Current subscription not found' },
        },
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
