import request from 'supertest';
import { buildApp } from '../app';

describe('user-ui core routes', () => {
  const app = buildApp();

  test('GET /healthz -> 200 {ok:true}', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('GET /health/live -> 200 ok', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('GET /health/ready -> 200 ok (test short-circuit)', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('GET /login -> 200 HTML', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('GET /dashboard unauthorized before login', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(401);
  });

  test('mock login then access dashboard', async () => {
    const agent = request.agent(app);
    const login = await agent.get('/auth/mock');
    expect([302, 303]).toContain(login.status);
    expect(login.headers['set-cookie']).toBeDefined();

    const dash = await agent.get('/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.headers['content-type']).toMatch(/text\/html/);
  });

  test('GET /register after mock login returns HTML', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent.get('/register');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('POST /register redirects to /dashboard', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent
      .post('/register')
      .type('form')
      .send({ purpose: 'internal_tooling', projectName: 'Proj', contactEmail: 'u@example.com' });
    expect([302, 303]).toContain(res.status);
    expect(res.headers.location).toBe('/dashboard');
  });

  test('session-check increments counter', async () => {
    const agent = request.agent(app);
    const r1 = await agent.get('/session-check');
    expect(r1.status).toBe(200);
    expect(r1.body.ok).toBe(true);

    const r2 = await agent.get('/session-check');
    expect(r2.status).toBe(200);
    expect(r2.body.count).toBe((r1.body.count || 0) + 1);
  });

  test('GET /keys after mock login returns HTML', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent.get('/keys');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('POST /keys issues key and returns display-once HTML', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent
      .post('/keys')
      .type('form')
      .send({ usageDescription: 'test key' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toMatch(/Copy your API key now/);
  });

  test('POST /keys/:id/revoke redirects to /keys', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent
      .post('/keys/some-id/revoke')
      .type('form')
      .send({});
    expect([302, 303]).toContain(res.status);
    expect(res.headers.location).toBe('/keys');
  });
});
