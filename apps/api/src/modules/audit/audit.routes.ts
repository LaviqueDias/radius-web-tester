import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';

export async function auditRoutes(fastify: FastifyInstance) {
  // Audit log is restricted to Admins
  fastify.addHook('preHandler', fastify.requireAdmin);

  fastify.get('/', async (request, reply) => {
    const query = request.query as { page?: string; limit?: string };
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '50', 10), 1), 100);
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
      }),
    ]);

    return reply.send({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      logs,
    });
  });
}
