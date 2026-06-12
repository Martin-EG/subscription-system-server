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
