import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '#/db'
import { auth } from '#/lib/auth'
import { requireAdmin } from '#/server/guards'
import { audit } from '#/lib/audit'
import { ROLES } from '#/lib/roles'
import { idSchema, userCreateSchema, userUpdateSchema } from '#/lib/validation'

export interface SerializedUser {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  recordCount: number
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  banned: true,
  createdAt: true,
  _count: { select: { bpRecords: true } },
} as const

function serialize(u: {
  id: string
  name: string
  email: string
  role: string | null
  banned: boolean | null
  createdAt: Date
  _count: { bpRecords: number }
}): SerializedUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role ?? ROLES.USER,
    isActive: !u.banned,
    createdAt: u.createdAt.toISOString(),
    recordCount: u._count.bpRecords,
  }
}

export const listUsers = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SerializedUser[]> => {
    await requireAdmin()
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    })
    return users.map(serialize)
  },
)

export const getUser = createServerFn({ method: 'GET' })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }): Promise<SerializedUser> => {
    await requireAdmin()
    const user = await prisma.user.findUnique({
      where: { id: data.id },
      select: userSelect,
    })
    if (!user) throw new Error('User not found')
    return serialize(user)
  })

export const createUser = createServerFn({ method: 'POST' })
  .validator((d: unknown) => userCreateSchema.parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const admin = await requireAdmin()
    const { headers } = getRequest()
    const res = await auth.api.createUser({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: data.role,
      },
      headers,
    })
    await audit({
      userId: admin.id,
      action: 'create',
      entity: 'User',
      entityId: res.user.id,
      metadata: { email: data.email, role: data.role },
    })
    return { id: res.user.id }
  })

export const updateUser = createServerFn({ method: 'POST' })
  .validator((d: unknown) => userUpdateSchema.parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const admin = await requireAdmin()
    const { headers } = getRequest()
    const target = await prisma.user.findUnique({ where: { id: data.id } })
    if (!target) throw new Error('User not found')

    // Guard against self-lockout.
    if (data.id === admin.id && data.isActive === false) {
      throw new Error('You cannot disable your own account')
    }
    if (data.id === admin.id && data.role && data.role !== ROLES.ADMIN) {
      throw new Error('You cannot remove your own admin role')
    }

    if (typeof data.name === 'string' && data.name !== target.name) {
      await prisma.user.update({ where: { id: data.id }, data: { name: data.name } })
    }
    if (data.role && data.role !== target.role) {
      await auth.api.setRole({ body: { userId: data.id, role: data.role }, headers })
    }
    if (typeof data.isActive === 'boolean') {
      const currentlyActive = !target.banned
      if (data.isActive && !currentlyActive) {
        await auth.api.unbanUser({ body: { userId: data.id }, headers })
      } else if (!data.isActive && currentlyActive) {
        await auth.api.banUser({ body: { userId: data.id }, headers })
      }
    }
    if (data.password && data.password.length >= 8) {
      await auth.api.setUserPassword({
        body: { userId: data.id, newPassword: data.password },
        headers,
      })
    }

    await audit({
      userId: admin.id,
      action: 'update',
      entity: 'User',
      entityId: data.id,
    })
    return { id: data.id }
  })

export const setUserActive = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ id: z.string().min(1), isActive: z.boolean() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ id: string; isActive: boolean }> => {
    const admin = await requireAdmin()
    const { headers } = getRequest()
    if (data.id === admin.id && !data.isActive) {
      throw new Error('You cannot disable your own account')
    }
    if (data.isActive) {
      await auth.api.unbanUser({ body: { userId: data.id }, headers })
    } else {
      await auth.api.banUser({ body: { userId: data.id }, headers })
    }
    await audit({
      userId: admin.id,
      action: data.isActive ? 'enable' : 'disable',
      entity: 'User',
      entityId: data.id,
    })
    return { id: data.id, isActive: data.isActive }
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const admin = await requireAdmin()
    if (data.id === admin.id) {
      throw new Error('You cannot delete your own account')
    }
    const { headers } = getRequest()
    await auth.api.removeUser({ body: { userId: data.id }, headers })
    await audit({
      userId: admin.id,
      action: 'delete',
      entity: 'User',
      entityId: data.id,
    })
    return { id: data.id }
  })
