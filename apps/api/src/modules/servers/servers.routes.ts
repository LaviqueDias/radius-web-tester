import { FastifyInstance } from 'fastify';
import { serverCreateSchema, serverUpdateSchema } from '@radius-web/shared';
import { prisma } from '../../lib/prisma';
import { encryptSecret } from '../../lib/crypto';
import { logAuditEvent } from '../audit/audit.service';

export async function serversRoutes(fastify: FastifyInstance) {
  // All server routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // List servers
  fastify.get('/', async (request, reply) => {
    const query = request.query as { enabledOnly?: string };
    const where = query.enabledOnly === 'true' ? { isEnabled: true } : {};

    const servers = await prisma.radiusServer.findMany({
      where,
      select: {
        id: true,
        name: true,
        host: true,
        authPort: true,
        accountingPort: true,
        coaPort: true,
        environment: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return reply.send({ servers });
  });

  // Get server by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const server = await prisma.radiusServer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        host: true,
        authPort: true,
        accountingPort: true,
        coaPort: true,
        environment: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!server) {
      return reply.status(404).send({ error: 'Servidor RADIUS não encontrado.' });
    }

    return reply.send({ server });
  });

  // Create server (Admin only)
  fastify.post('/', { preHandler: [fastify.requireAdmin] }, async (request, reply) => {
    const parseResult = serverCreateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos.',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const data = parseResult.data;
    const encryptedSecret = encryptSecret(data.sharedSecret);

    const server = await prisma.radiusServer.create({
      data: {
        name: data.name,
        host: data.host,
        authPort: data.authPort,
        accountingPort: data.accountingPort,
        coaPort: data.coaPort,
        secretReference: encryptedSecret,
        environment: data.environment,
        isEnabled: data.isEnabled,
      },
      select: {
        id: true,
        name: true,
        host: true,
        authPort: true,
        accountingPort: true,
        coaPort: true,
        environment: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAuditEvent({
      userId: request.user!.id,
      action: 'server_created',
      resource: server.id,
      details: { name: server.name, host: server.host, environment: server.environment },
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      message: 'Servidor RADIUS cadastrado com sucesso.',
      server,
    });
  });

  // Update server (Admin only)
  fastify.patch('/:id', { preHandler: [fastify.requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = serverUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos.',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const data = parseResult.data;
    const updatePayload: Record<string, any> = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.host !== undefined) updatePayload.host = data.host;
    if (data.authPort !== undefined) updatePayload.authPort = data.authPort;
    if (data.accountingPort !== undefined) updatePayload.accountingPort = data.accountingPort;
    if (data.coaPort !== undefined) updatePayload.coaPort = data.coaPort;
    if (data.environment !== undefined) updatePayload.environment = data.environment;
    if (data.isEnabled !== undefined) updatePayload.isEnabled = data.isEnabled;
    if (data.sharedSecret !== undefined && data.sharedSecret.length > 0) {
      updatePayload.secretReference = encryptSecret(data.sharedSecret);
    }

    const server = await prisma.radiusServer.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        name: true,
        host: true,
        authPort: true,
        accountingPort: true,
        coaPort: true,
        environment: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAuditEvent({
      userId: request.user!.id,
      action: 'server_updated',
      resource: server.id,
      details: { name: server.name, host: server.host },
      ipAddress: request.ip,
    });

    return reply.send({
      message: 'Servidor RADIUS atualizado com sucesso.',
      server,
    });
  });

  // Disable server (Admin only)
  fastify.post('/:id/disable', { preHandler: [fastify.requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const server = await prisma.radiusServer.update({
      where: { id },
      data: { isEnabled: false },
      select: {
        id: true,
        name: true,
        isEnabled: true,
      },
    });

    await logAuditEvent({
      userId: request.user!.id,
      action: 'server_disabled',
      resource: server.id,
      ipAddress: request.ip,
    });

    return reply.send({
      message: 'Servidor desabilitado com sucesso.',
      server,
    });
  });

  // Delete server (Admin only)
  fastify.delete('/:id', { preHandler: [fastify.requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await prisma.radiusServer.delete({
      where: { id },
    });

    await logAuditEvent({
      userId: request.user!.id,
      action: 'server_deleted',
      resource: id,
      ipAddress: request.ip,
    });

    return reply.send({ message: 'Servidor removido com sucesso.' });
  });
}
