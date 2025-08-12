import request from 'supertest';
import { buildApp } from '../app';

describe('admin-ui core routes', () => {
  const app = buildApp();

  test('GET /healthz -> 200 {ok:true}', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('GET /login -> 200 HTML', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('GET /health/live -> 200 {ok:true}', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('GET /health/ready -> 200 {ok:true}', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('GET /admin/users unauthorized before login', async () => {
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(401);
  });

  test('GET /admin/registrations unauthorized before login', async () => {
    const res = await request(app).get('/admin/registrations');
    expect(res.status).toBe(401);
  });

  test('GET /admin/keys unauthorized before login', async () => {
    const res = await request(app).get('/admin/keys');
    expect(res.status).toBe(401);
  });

  test('GET /admin/audit-logs unauthorized before login', async () => {
    const res = await request(app).get('/admin/audit-logs');
    expect(res.status).toBe(401);
  });

  test('mock login then access /admin/users', async () => {
    const agent = request.agent(app);
    const login = await agent.get('/auth/mock');
    expect([302, 303]).toContain(login.status);
    expect(login.headers['set-cookie']).toBeDefined();

    const adminUsers = await agent.get('/admin/users');
    expect(adminUsers.status).toBe(200);
    expect(adminUsers.headers['content-type']).toMatch(/text\/html/);
  });

  test('mock login then access /admin/registrations', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent.get('/admin/registrations');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('mock login then access /admin/keys', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent.get('/admin/keys');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('mock login then access /admin/audit-logs', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent.get('/admin/audit-logs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
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

  // New admin users tests
  test('RBAC: POST activate/deactivate requires auth', async () => {
    const res1 = await request(app).post('/admin/users/nonexistent/activate');
    expect(res1.status).toBe(401);
    const res2 = await request(app).post('/admin/users/nonexistent/deactivate');
    expect(res2.status).toBe(401);
  });

  test('after mock login: GET /admin/users supports search & paging (HTML)', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent.get('/admin/users')
      .query({ q: 'someone@example.com', page: '2', pageSize: '5' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('after mock login: GET /admin/users/:id renders detail in test mode', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const res = await agent.get('/admin/users/nonexistent');
    // In test env, detail returns a placeholder page (200) rather than 404
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('after mock login: POST activate/deactivate redirect back to detail (test mode)', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/mock');
    const id = 'nonexistent';
    const a = await agent.post(`/admin/users/${id}/activate`);
    expect([302, 303]).toContain(a.status);
    expect(a.headers['location']).toBe(`/admin/users/${id}`);
    const d = await agent.post(`/admin/users/${id}/deactivate`);
    expect([302, 303]).toContain(d.status);
    expect(d.headers['location']).toBe(`/admin/users/${id}`);
  });
});
