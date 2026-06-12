import request from 'supertest';
import { createApp } from '../src/app.js';

describe('HTTP application scaffold', () => {
  const app = createApp();

  it('reports service health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  const placeholderRequests = [
    () => request(app).post('/api/v1/subscriptions/checkout'),
    () => request(app).patch('/api/v1/subscriptions/cancel'),
    () => request(app).patch('/api/v1/subscriptions/renew'),
    () => request(app).get('/api/v1/subscriptions'),
    () => request(app).get('/api/v1/subscriptions/user-placeholder'),
    () => request(app).get('/api/v1/payments'),
  ];

  it.each(placeholderRequests)('returns 501 for a business endpoint', async (sendRequest) => {
    const response = await sendRequest();

    expect(response.status).toBe(501);
    expect(response.body).toMatchObject({
      title: 'Not Implemented',
      status: 501,
    });
  });
});
