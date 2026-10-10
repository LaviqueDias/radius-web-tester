import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let operatorToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Login as admin
    const adminRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    const adminData = JSON.parse(adminRes.payload);
    adminToken = adminData.token;

    // Login as operator
    const opRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'operator', password: 'operator123' },
    });
    const opData = JSON.parse(opRes.payload);
    operatorToken = opData.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 with database connected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('healthy');
    expect(body.database).toBe('connected');
  });

  it('POST /api/auth/login fails gracefully with invalid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nonexistent', password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('Usuário ou senha inválidos');
  });

  it('GET /api/auth/me returns current user info when authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.user.username).toBe('admin');
    expect(body.user.role).toBe('admin');
  });

  it('GET /api/servers returns servers list without revealing shared secret', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/servers',
      headers: {
        authorization: `Bearer ${operatorToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.servers)).toBe(true);
    expect(body.servers.length).toBeGreaterThan(0);
    expect(body.servers[0].secretReference).toBeUndefined();
    expect(body.servers[0].sharedSecret).toBeUndefined();
  });

  it('POST /api/servers forbids operator from creating servers (RBAC)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/servers',
      headers: {
        authorization: `Bearer ${operatorToken}`,
      },
      payload: {
        name: 'Unauthorized Server',
        host: '192.168.10.1',
        authPort: 1812,
        accountingPort: 1813,
        sharedSecret: 'secret',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('Acesso negado');
  });

  it('POST /api/packets/preview formats payload and validates Acct-Status-Type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/packets/preview',
      headers: {
        authorization: `Bearer ${operatorToken}`,
      },
      payload: {
        packetType: 'accounting-start',
        attributes: [
          { name: 'User-Name', value: 'assinante-01' },
          { name: 'Acct-Status-Type', value: 'Start' },
          { name: 'NAS-IP-Address', value: '192.168.1.1' },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.valid).toBe(true);
    expect(body.previewStdin).toContain('Acct-Status-Type = Start');
    expect(body.previewStdin).toContain('User-Name = assinante-01');
  });

  it('POST /api/packets/preview rejects mismatched Acct-Status-Type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/packets/preview',
      headers: {
        authorization: `Bearer ${operatorToken}`,
      },
      payload: {
        packetType: 'accounting-start',
        attributes: [
          { name: 'User-Name', value: 'assinante-01' },
          { name: 'Acct-Status-Type', value: 'Stop' },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain("deve ser 'Start'");
  });
});
