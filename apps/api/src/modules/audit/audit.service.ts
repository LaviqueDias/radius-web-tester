import { prisma } from '../../lib/prisma';

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  resource?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
}

export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        resource: input.resource || null,
        detailsJson: input.details ? (input.details as any) : undefined,
        ipAddress: input.ipAddress || null,
      },
    });
  } catch (error) {
    // Audit logging should not crash the main application, but log error
    console.error('Falha ao registrar log de auditoria:', error);
  }
}
