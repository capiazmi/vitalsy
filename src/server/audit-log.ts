import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '#/db'
import { requireAdmin } from '#/server/guards'
import type { Prisma } from '#/generated/prisma/client.js'

export interface SerializedAuditLog {
  id: string
  action: string
  entity: string
  entityId: string | null
  createdAt: string
  user: { name: string; email: string } | null
}

const querySchema = z.object({
  action: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
})

/** Recent audit-log entries (admin). Optionally filter by action. */
export const listAuditLogs = createServerFn({ method: 'GET' })
  .validator((d: unknown) => querySchema.parse(d ?? {}))
  .handler(async ({ data }): Promise<Array<SerializedAuditLog>> => {
    await requireAdmin()
    const where: Prisma.AuditLogWhereInput = {}
    if (data.action) where.action = data.action

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: data.limit ?? 100,
      include: { user: { select: { name: true, email: true } } },
    })
    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      createdAt: l.createdAt.toISOString(),
      user: l.user ? { name: l.user.name, email: l.user.email } : null,
    }))
  })
