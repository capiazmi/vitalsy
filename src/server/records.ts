import { createServerFn } from '@tanstack/react-start'
import { prisma } from '#/db'
import { requireUser } from '#/server/guards'
import { audit } from '#/lib/audit'
import { getObject, isS3Configured, publicUrl, uploadImage } from '#/lib/s3'
import { ROLES } from '#/lib/roles'
import {
  bpRecordInputSchema,
  bpRecordUpdateSchema,
  idSchema,
  recordsQuerySchema,
  type RecordsQuery,
} from '#/lib/validation'
import type { Prisma } from '#/generated/prisma/client.js'

export interface SerializedRecord {
  id: string
  userId: string
  systolic: number
  diastolic: number
  pulse: number | null
  notes: string | null
  recordedAt: string
  imagePath: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; name: string; email: string }
}

type RecordWithUser = Prisma.BloodPressureRecordGetPayload<{
  include: { user: { select: { id: true; name: true; email: true } } }
}>

function serialize(r: RecordWithUser): SerializedRecord {
  return {
    id: r.id,
    userId: r.userId,
    systolic: r.systolic,
    diastolic: r.diastolic,
    pulse: r.pulse,
    notes: r.notes,
    recordedAt: r.recordedAt.toISOString(),
    imagePath: r.imagePath,
    imageUrl: publicUrl(r.imagePath),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : undefined,
  }
}

function resolveRange(q: RecordsQuery): { gte?: Date; lte?: Date } {
  if (q.range === 'all') return {}
  if (q.range === 'custom') {
    return {
      gte: q.from ? new Date(q.from) : undefined,
      lte: q.to ? new Date(q.to) : undefined,
    }
  }
  const days = parseInt(q.range, 10)
  return { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
}

/** List records. USER sees only their own; ADMIN sees all (optionally one user). */
export const listRecords = createServerFn({ method: 'GET' })
  .validator((d: unknown) => recordsQuerySchema.parse(d))
  .handler(async ({ data }): Promise<SerializedRecord[]> => {
    const user = await requireUser()

    const where: Prisma.BloodPressureRecordWhereInput = {}
    if (user.role === ROLES.ADMIN) {
      if (data.userId) where.userId = data.userId
    } else {
      where.userId = user.id
    }

    const { gte, lte } = resolveRange(data)
    if (gte || lte) {
      where.recordedAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) }
    }

    const records = await prisma.bloodPressureRecord.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    return records.map(serialize)
  })

/** Fetch a single record (owner or admin). */
export const getRecord = createServerFn({ method: 'GET' })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }): Promise<SerializedRecord> => {
    const user = await requireUser()
    const record = await prisma.bloodPressureRecord.findUnique({
      where: { id: data.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    if (!record) throw new Error('Record not found')
    if (user.role !== ROLES.ADMIN && record.userId !== user.id) {
      throw new Error('You do not have access to this record')
    }
    return serialize(record)
  })

/** Returns the record's stored image as a data URL (owner/admin only). */
export const getRecordImage = createServerFn({ method: 'GET' })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }): Promise<{ dataUrl: string | null }> => {
    const user = await requireUser()
    const record = await prisma.bloodPressureRecord.findUnique({
      where: { id: data.id },
      select: { userId: true, imagePath: true },
    })
    if (!record?.imagePath) return { dataUrl: null }
    if (user.role !== ROLES.ADMIN && record.userId !== user.id) {
      throw new Error('You do not have access to this image')
    }
    const obj = await getObject(record.imagePath)
    if (!obj) return { dataUrl: null }
    const base64 = Buffer.from(obj.body).toString('base64')
    return { dataUrl: `data:${obj.contentType};base64,${base64}` }
  })

export const createRecord = createServerFn({ method: 'POST' })
  .validator((d: unknown) => bpRecordInputSchema.parse(d))
  .handler(async ({ data }): Promise<SerializedRecord> => {
    const user = await requireUser()
    const record = await prisma.bloodPressureRecord.create({
      data: {
        userId: user.id,
        systolic: data.systolic,
        diastolic: data.diastolic,
        pulse: data.pulse ?? null,
        notes: data.notes ?? null,
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
        imagePath: data.imagePath ?? null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    await audit({
      userId: user.id,
      action: 'create',
      entity: 'BloodPressureRecord',
      entityId: record.id,
    })
    return serialize(record)
  })

/**
 * Save a reading from the OCR flow. Accepts FormData with the BP fields and an
 * optional cropped `image` file. The image is uploaded to S3 ONLY here, at save
 * time — so abandoned scans never orphan an object in the bucket.
 */
export const createRecordFromScan = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error('Expected form data')
    return data
  })
  .handler(async ({ data }): Promise<SerializedRecord> => {
    const user = await requireUser()

    const pulseRaw = (data.get('pulse') as string | null)?.trim()
    const notesRaw = (data.get('notes') as string | null)?.trim()
    const recordedAtRaw = (data.get('recordedAt') as string | null) ?? undefined

    const parsed = bpRecordInputSchema.parse({
      systolic: data.get('systolic'),
      diastolic: data.get('diastolic'),
      pulse: pulseRaw ? pulseRaw : undefined,
      notes: notesRaw ? notesRaw : undefined,
      recordedAt: recordedAtRaw,
    })

    // Upload the cropped image only now that the user has committed to saving.
    // A storage failure must not lose the reading — save without the image.
    let imagePath: string | null = null
    const file = data.get('image')
    if (file instanceof File && file.size > 0 && isS3Configured()) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const contentType = file.type || 'image/jpeg'
        const ext = contentType === 'image/png' ? 'png' : 'jpg'
        const key = `bp/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
        imagePath = (await uploadImage(key, buffer, contentType)) ?? null
      } catch (err) {
        console.error('[records] image upload failed; saving without image', err)
      }
    }

    const record = await prisma.bloodPressureRecord.create({
      data: {
        userId: user.id,
        systolic: parsed.systolic,
        diastolic: parsed.diastolic,
        pulse: parsed.pulse ?? null,
        notes: parsed.notes ?? null,
        recordedAt: parsed.recordedAt ?? new Date(),
        imagePath,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    await audit({
      userId: user.id,
      action: 'create',
      entity: 'BloodPressureRecord',
      entityId: record.id,
      metadata: { source: 'ocr', hasImage: imagePath !== null },
    })
    return serialize(record)
  })

export const updateRecord = createServerFn({ method: 'POST' })
  .validator((d: unknown) => bpRecordUpdateSchema.parse(d))
  .handler(async ({ data }): Promise<SerializedRecord> => {
    const user = await requireUser()
    const existing = await prisma.bloodPressureRecord.findUnique({
      where: { id: data.id },
    })
    if (!existing) throw new Error('Record not found')
    if (user.role !== ROLES.ADMIN && existing.userId !== user.id) {
      throw new Error('You do not have access to this record')
    }

    const record = await prisma.bloodPressureRecord.update({
      where: { id: data.id },
      data: {
        systolic: data.systolic,
        diastolic: data.diastolic,
        pulse: data.pulse ?? null,
        notes: data.notes ?? null,
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : existing.recordedAt,
        imagePath: data.imagePath ?? existing.imagePath,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    await audit({
      userId: user.id,
      action: 'update',
      entity: 'BloodPressureRecord',
      entityId: record.id,
    })
    return serialize(record)
  })

export const deleteRecord = createServerFn({ method: 'POST' })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const user = await requireUser()
    const existing = await prisma.bloodPressureRecord.findUnique({
      where: { id: data.id },
    })
    if (!existing) throw new Error('Record not found')
    if (user.role !== ROLES.ADMIN && existing.userId !== user.id) {
      throw new Error('You do not have access to this record')
    }
    await prisma.bloodPressureRecord.delete({ where: { id: data.id } })
    await audit({
      userId: user.id,
      action: 'delete',
      entity: 'BloodPressureRecord',
      entityId: data.id,
    })
    return { id: data.id }
  })
