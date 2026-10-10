import { FastifyInstance } from 'fastify';
import {
  PACKET_TYPES_METADATA,
  POPULAR_RADIUS_ATTRIBUTES,
  SUGGESTED_ATTRIBUTES,
  formatAttributesForRadclient,
  packetPreviewSchema,
  packetSendSchema,
  validateAcctStatusConsistency,
} from '@radius-web/shared';
import { prisma } from '../../lib/prisma';
import { decryptSecret } from '../../lib/crypto';
import { executeRadclient } from '../execution/radclient-executor';
import { logAuditEvent } from '../audit/audit.service';

export async function packetsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // List supported packet types and suggested attributes
  fastify.get('/types', async (_request, reply) => {
    return reply.send({
      packetTypes: Object.values(PACKET_TYPES_METADATA),
      suggestedAttributes: SUGGESTED_ATTRIBUTES,
      popularAttributes: POPULAR_RADIUS_ATTRIBUTES,
    });
  });

  // Preview packet attributes formatted for radclient stdin
  fastify.post('/preview', async (request, reply) => {
    const parseResult = packetPreviewSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados de prévia inválidos.',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { packetType, attributes } = parseResult.data;

    // Check Acct-Status-Type consistency
    const consistency = validateAcctStatusConsistency(packetType, attributes);
    if (!consistency.valid) {
      return reply.status(400).send({
        error: consistency.message,
        consistencyWarning: consistency.message,
      });
    }

    // Format for preview with sensitive fields masked
    const previewStdin = formatAttributesForRadclient(attributes, { redactSensitive: true });

    return reply.send({
      valid: true,
      packetType,
      attributeCount: attributes.length,
      previewStdin,
    });
  });

  // Send packet to authorized RADIUS server
  fastify.post('/send', async (request, reply) => {
    const parseResult = packetSendSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Parâmetros de envio inválidos.',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { serverId, packetType, attributes, options, disruptiveConfirmed } = parseResult.data;

    // Check metadata and disruptive confirmation
    const meta = PACKET_TYPES_METADATA[packetType];
    if (meta.isDisruptive && !disruptiveConfirmed) {
      return reply.status(400).send({
        error: `O tipo de pacote '${meta.label}' pode interromper sessões de usuários reais e requer confirmação explícita.`,
        requiresConfirmation: true,
      });
    }

    // Check Acct-Status-Type consistency
    const consistency = validateAcctStatusConsistency(packetType, attributes);
    if (!consistency.valid) {
      return reply.status(400).send({ error: consistency.message });
    }

    // Lookup authorized server
    const server = await prisma.radiusServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return reply.status(404).send({ error: 'Servidor RADIUS não encontrado ou não cadastrado.' });
    }

    if (!server.isEnabled) {
      return reply.status(400).send({
        error: `O servidor '${server.name}' está desabilitado e não aceita envios no momento.`,
      });
    }

    // Determine target port from server config and packet type
    let targetPort = server.authPort;
    if (meta.portField === 'accountingPort') {
      targetPort = server.accountingPort;
    } else if (meta.portField === 'coaPort') {
      targetPort = server.coaPort || 3799;
    }

    // Decrypt shared secret
    let sharedSecret = '';
    try {
      sharedSecret = decryptSecret(server.secretReference);
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Falha ao recuperar a credencial protegida do servidor RADIUS.',
      });
    }

    // Execute radclient
    const result = await executeRadclient({
      host: server.host,
      port: targetPort,
      mode: meta.defaultMode,
      sharedSecret,
      packetType,
      attributes,
      timeoutSeconds: options.timeoutSeconds,
      retries: options.retries,
    });

    // Redact sensitive attributes before saving to database
    const redactedAttributes = attributes.map((attr) => {
      const isSensitive = attr.isSensitive || /password|secret|key/i.test(attr.name);
      return {
        name: attr.name,
        value: isSensitive ? '***REDACTED***' : attr.value,
        operator: attr.operator || '=',
      };
    });

    // Save execution record
    const execution = await prisma.execution.create({
      data: {
        userId: request.user!.id,
        serverId: server.id,
        packetType,
        status: result.status,
        responseCode: result.responseCode,
        durationMs: result.durationMs,
        exitCode: result.exitCode,
        stdoutRedacted: result.stdout,
        stderrRedacted: result.stderr,
        optionsJson: options as any,
        attributesJson: redactedAttributes as any,
      },
    });

    // Audit log
    await logAuditEvent({
      userId: request.user!.id,
      action: 'packet_sent',
      resource: execution.id,
      details: {
        serverId: server.id,
        serverName: server.name,
        packetType,
        status: result.status,
        responseCode: result.responseCode,
        durationMs: result.durationMs,
      },
      ipAddress: request.ip,
    });

    return reply.send({
      executionId: execution.id,
      status: result.status,
      packetType,
      destination: server.name,
      host: server.host,
      port: targetPort,
      durationMs: result.durationMs,
      responseCode: result.responseCode,
      summary: result.summary,
      attributes: result.attributes,
      stdout: result.stdout,
      stderr: result.stderr,
      createdAt: execution.createdAt,
    });
  });
}
