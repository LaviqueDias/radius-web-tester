import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { logAuditEvent } from '../audit/audit.service';

export async function historyRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // List executions with filters and pagination
  fastify.get('/', async (request, reply) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      serverId?: string;
      packetType?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    };

    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (query.serverId) where.serverId = query.serverId;
    if (query.packetType) where.packetType = query.packetType;
    if (query.status) where.status = query.status;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [total, executions] = await Promise.all([
      prisma.execution.count({ where }),
      prisma.execution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          packetType: true,
          status: true,
          responseCode: true,
          durationMs: true,
          exitCode: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          server: {
            select: {
              id: true,
              name: true,
              host: true,
              environment: true,
            },
          },
        },
      }),
    ]);

    return reply.send({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      executions,
    });
  });

  // Dashboard summary stats
  fastify.get('/stats', async (_request, reply) => {
    const [
      totalExecutions,
      successCount,
      rejectCount,
      timeoutCount,
      errorCount,
      serversCount,
      recentExecutions,
    ] = await Promise.all([
      prisma.execution.count(),
      prisma.execution.count({ where: { status: 'response_received' } }),
      prisma.execution.count({ where: { status: 'rejected' } }),
      prisma.execution.count({ where: { status: 'timeout' } }),
      prisma.execution.count({ where: { status: 'execution_error' } }),
      prisma.radiusServer.count({ where: { isEnabled: true } }),
      prisma.execution.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          packetType: true,
          status: true,
          responseCode: true,
          durationMs: true,
          createdAt: true,
          server: { select: { name: true } },
          user: { select: { username: true } },
        },
      }),
    ]);

    return reply.send({
      totalExecutions,
      successCount,
      rejectCount,
      timeoutCount,
      errorCount,
      activeServersCount: serversCount,
      recentExecutions,
    });
  });

  // Get specific execution details
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const execution = await prisma.execution.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
        server: {
          select: {
            id: true,
            name: true,
            host: true,
            authPort: true,
            accountingPort: true,
            coaPort: true,
            environment: true,
          },
        },
      },
    });

    if (!execution) {
      return reply.status(404).send({ error: 'Execução não encontrada.' });
    }

    return reply.send({ execution });
  });

  // Purge executions older than X days (Admin only)
  fastify.post('/purge', { preHandler: [fastify.requireAdmin] }, async (request, reply) => {
    const body = request.body as { days?: number };
    const days = Math.max(body?.days || 30, 1);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deleteResult = await prisma.execution.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    await logAuditEvent({
      userId: request.user!.id,
      action: 'history_purged',
      details: { days, count: deleteResult.count },
      ipAddress: request.ip,
    });

    return reply.send({
      message: `Expurgo concluído: ${deleteResult.count} execuções anteriores a ${days} dias foram removidas.`,
      purgedCount: deleteResult.count,
    });
  });
}
