import { prisma } from '#/db'
import type { Prisma } from '#/generated/prisma/client.js'

interface AuditInput {
  userId?: string | null
  action: string
  entity: string
  entityId?: string | null
  metadata?: Prisma.InputJsonValue
}

/** Best-effort audit log write. Never throws (auditing must not break flows). */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
      },
    })
  } catch (err) {
    console.error('[audit] failed to write log', err)
  }
}
