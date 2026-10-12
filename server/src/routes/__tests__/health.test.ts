import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';

describe('Health API', () => {
  it('GET /api/health should return 200 with status ok and database stats', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBeDefined();
    expect(res.body.database.connected).toBe(true);
    expect(res.body.database.productCount).toBeGreaterThan(0);
    expect(res.body.gemini).toBeDefined();
    expect(typeof res.body.gemini.configured).toBe('boolean');
  });

  it('GET / should return root application info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Mini Shopping Assistant API');
  });
});
