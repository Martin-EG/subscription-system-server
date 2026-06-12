import express from 'express';
import request from 'supertest';
import { validateBody } from '../../../../src/presentation/http/middlewares/validate.middleware.js';
import { loginBodySchema } from '../../../../src/presentation/http/schemas/auth.schemas.js';

describe('validateBody', () => {
  const app = express();
  app.use(express.json());
  app.post('/login', validateBody(loginBodySchema), (req, res) => {
    res.status(200).json(req.body);
  });

  it('passes validated request bodies', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'jane@example.com', password: 'Demo123' });

    expect(response.status).toBe(200);
  });

  it('returns 400 for invalid bodies', async () => {
    const response = await request(app).post('/login').send({ email: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
    });
  });
});
