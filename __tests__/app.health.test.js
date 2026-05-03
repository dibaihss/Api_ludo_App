const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('returns a side-effect free readiness payload', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'Strategic Ludo Game Backend API'
    });
  });
});