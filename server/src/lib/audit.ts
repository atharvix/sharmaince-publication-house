import { prisma } from './prisma.js';

interface RecordAuditInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export function recordAudit({ actorUserId, action, entityType, entityId, metadata }: RecordAuditInput) {
  return prisma.auditEvent.create({
    data: {
      actorUserId: actorUserId ?? null,
      action,
      entityType,
      entityId,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });
}
