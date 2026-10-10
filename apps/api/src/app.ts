import path from 'path';
import dotenv from 'dotenv';
// Load environment variables before anything else
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { execFile } from 'child_process';
import { promisify } from 'util';

import authPlugin from './plugins/auth.plugin';
import { authRoutes } from './modules/auth/auth.routes';
import { serversRoutes } from './modules/servers/servers.routes';
import { packetsRoutes } from './modules/packets/packets.routes';
import { historyRoutes } from './modules/history/history.routes';
import { templatesRoutes } from './modules/templates/templates.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { prisma } from './lib/prisma';

const execFileAsync = promisify(execFile);

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development',
    bodyLimit: 1048576, // 1MB
  });

  // CORS
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Cookies
  await app.register(cookie);

  // JWT
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'supersecret-radius-web-tester-dev-key-2026-min-32-chars',
  });

  // Auth & RBAC plugin
  await app.register(authPlugin);

  // Health check endpoint
  app.get('/api/health', async (_req, reply) => {
    let dbStatus = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (err: any) {
      dbStatus = `error: ${err.message}`;
    }

    let radclientInstalled = false;
    let radclientVersion = 'not_found';
    const radclientPath = process.env.RADCLIENT_PATH || 'radclient';

    try {
      const { stdout, stderr } = await execFileAsync(radclientPath, ['-v'], { timeout: 2000 });
      radclientInstalled = true;
      radclientVersion = (stdout || stderr).trim().split('\n')[0] || 'installed';
    } catch (err: any) {
      // It's normal if radclient isn't installed directly on host dev machine
      radclientVersion = `not_found: ${err.message}`;
    }

    const isHealthy = dbStatus === 'connected';

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'healthy' : 'degraded',
      database: dbStatus,
      radclient: {
        path: radclientPath,
        installed: radclientInstalled,
        versionInfo: radclientVersion,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // API modules
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(serversRoutes, { prefix: '/api/servers' });
  await app.register(packetsRoutes, { prefix: '/api/packets' });
  await app.register(historyRoutes, { prefix: '/api/executions' });
  await app.register(templatesRoutes, { prefix: '/api/templates' });
  await app.register(auditRoutes, { prefix: '/api/audit' });

  // Global Error Handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: error.message || 'Erro interno no servidor.',
      statusCode,
    });
  });

  return app;
}

// Start standalone server
async function start() {
  try {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`🚀 RADIUS Web Tester API em execução em http://${host}:${port}`);
  } catch (err) {
    console.error('Falha ao iniciar o servidor:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
