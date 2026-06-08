import { createServerFn } from '@tanstack/react-start'
import { prisma } from '#/db'
import { requireAdmin, requireUser } from '#/server/guards'

export interface UserDashboard {
  count: number
  latest: {
    systolic: number
    diastolic: number
    pulse: number | null
    recordedAt: string
  } | null
  avgSystolic: number | null
  avgDiastolic: number | null
  avgPulse: number | null
}

export const userDashboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<UserDashboard> => {
    const user = await requireUser()
    const where = { userId: user.id }

    const [count, latest, agg] = await Promise.all([
      prisma.bloodPressureRecord.count({ where }),
      prisma.bloodPressureRecord.findFirst({
        where,
        orderBy: { recordedAt: 'desc' },
      }),
      prisma.bloodPressureRecord.aggregate({
        where,
        _avg: { systolic: true, diastolic: true, pulse: true },
      }),
    ])

    const round = (n: number | null) => (n === null ? null : Math.round(n))

    return {
      count,
      latest: latest
        ? {
            systolic: latest.systolic,
            diastolic: latest.diastolic,
            pulse: latest.pulse,
            recordedAt: latest.recordedAt.toISOString(),
          }
        : null,
      avgSystolic: round(agg._avg.systolic),
      avgDiastolic: round(agg._avg.diastolic),
      avgPulse: round(agg._avg.pulse),
    }
  },
)

export interface AdminDashboard {
  totalUsers: number
  activeUsers: number
  totalReadings: number
  recent: Array<{
    id: string
    systolic: number
    diastolic: number
    pulse: number | null
    recordedAt: string
    user: { id: string; name: string; email: string } | null
  }>
}

export const adminDashboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminDashboard> => {
    await requireAdmin()

    const [totalUsers, activeUsers, totalReadings, recent] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { banned: { not: true } } }),
      prisma.bloodPressureRecord.count(),
      prisma.bloodPressureRecord.findMany({
        orderBy: { recordedAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ])

    return {
      totalUsers,
      activeUsers,
      totalReadings,
      recent: recent.map((r) => ({
        id: r.id,
        systolic: r.systolic,
        diastolic: r.diastolic,
        pulse: r.pulse,
        recordedAt: r.recordedAt.toISOString(),
        user: r.user
          ? { id: r.user.id, name: r.user.name, email: r.user.email }
          : null,
      })),
    }
  },
)
