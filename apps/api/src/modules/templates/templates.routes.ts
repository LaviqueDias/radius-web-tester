import { FastifyInstance } from 'fastify';
import { templateCreateSchema, templateUpdateSchema } from '@radius-web/shared';
import { prisma } from '../../lib/prisma';
import { logAuditEvent } from '../audit/audit.service';

export async function templatesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // List templates
  fastify.get('/', async (_request, reply) => {
    const templates = await prisma.packetTemplate.findMany({
      orderBy: { name: 'asc' },
      include: {
        createdBy: {
          select: { id: true, username: true },
        },
      },
    });

    return reply.send({ templates });
  });

  // Get template by id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const template = await prisma.packetTemplate.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, username: true } },
      },
    });

    if (!template) {
      return reply.status(404).send({ error: 'Modelo de pacote não encontrado.' });
    }

    return reply.send({ template });
  });

  // Create template
  fastify.post('/', async (request, reply) => {
    const parseResult = templateCreateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados de modelo inválidos.',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const data = parseResult.data;

    // Filter out any sensitive values like raw passwords before storing in template
    const cleanAttributes = data.attributes.map((attr) => {
      const isSensitive = attr.isSensitive || /password|secret|key/i.test(attr.name);
      return {
        ...attr,
        value: isSensitive ? '' : attr.value,
      };
    });

    const template = await prisma.packetTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        packetType: data.packetType,
        attributesJson: cleanAttributes as any,
        createdById: request.user!.id,
      },
      include: {
        createdBy: { select: { id: true, username: true } },
      },
    });

    await logAuditEvent({
      userId: request.user!.id,
      action: 'template_created',
      resource: template.id,
      details: { name: template.name, packetType: template.packetType },
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      message: 'Modelo de pacote criado com sucesso.',
      template,
    });
  });

  // Update template
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = templateUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos.',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const data = parseResult.data;
    const updatePayload: Record<string, any> = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.packetType !== undefined) updatePayload.packetType = data.packetType;
    if (data.attributes !== undefined) {
      const cleanAttributes = data.attributes.map((attr) => {
        const isSensitive = attr.isSensitive || /password|secret|key/i.test(attr.name);
        return {
          ...attr,
          value: isSensitive ? '' : attr.value,
        };
      });
      updatePayload.attributesJson = cleanAttributes as any;
    }

    const template = await prisma.packetTemplate.update({
      where: { id },
      data: updatePayload,
      include: {
        createdBy: { select: { id: true, username: true } },
      },
    });

    await logAuditEvent({
      userId: request.user!.id,
      action: 'template_updated',
      resource: template.id,
      details: { name: template.name },
      ipAddress: request.ip,
    });

    return reply.send({
      message: 'Modelo atualizado com sucesso.',
      template,
    });
  });

  // Delete template
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await prisma.packetTemplate.delete({
      where: { id },
    });

    await logAuditEvent({
      userId: request.user!.id,
      action: 'template_deleted',
      resource: id,
      ipAddress: request.ip,
    });

    return reply.send({ message: 'Modelo excluído com sucesso.' });
  });
}
