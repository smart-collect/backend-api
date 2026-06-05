import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index';
import request from 'supertest';

describe('Health Check', () => {
  it('GET /health doit retourner le statut UP', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('status', 'UP');
  });
});

describe('404 Not Found', () => {
  it('Route inexistante doit retourner 404', async () => {
    const response = await request(app)
      .get('/route-inexistante')
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
