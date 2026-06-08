import { z } from 'zod'
import { ROLES } from '#/lib/roles'

// ── Blood pressure records ─────────────────────────────────

const optionalTrimmed = z
  .string()
  .trim()
  .max(2000, 'Too long')
  .optional()
  .transform((v) => (v === '' ? undefined : v))

export const bpRecordInputSchema = z.object({
  systolic: z.coerce
    .number({ message: 'Systolic is required' })
    .int('Must be a whole number')
    .min(40, 'Too low')
    .max(300, 'Too high'),
  diastolic: z.coerce
    .number({ message: 'Diastolic is required' })
    .int('Must be a whole number')
    .min(20, 'Too low')
    .max(200, 'Too high'),
  pulse: z.coerce
    .number()
    .int('Must be a whole number')
    .min(20, 'Too low')
    .max(250, 'Too high')
    .optional(),
  notes: optionalTrimmed,
  // Accepts an ISO string or datetime-local value; defaults to "now" server-side.
  recordedAt: z.coerce.date().optional(),
  imagePath: z.string().max(1024).optional(),
})

export type BpRecordInput = z.infer<typeof bpRecordInputSchema>

export const bpRecordUpdateSchema = bpRecordInputSchema.extend({
  id: z.string().min(1),
})

export const idSchema = z.object({ id: z.string().min(1) })

export const recordsQuerySchema = z.object({
  // server-side filtering window
  range: z.enum(['7', '30', '90', 'custom', 'all']).default('30'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  userId: z.string().optional(), // admin only
})

export type RecordsQuery = z.infer<typeof recordsQuerySchema>

// ── Users (admin) ──────────────────────────────────────────

export const roleSchema = z.enum([ROLES.ADMIN, ROLES.USER])

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters').max(128),
  role: roleSchema.default(ROLES.USER),
})

export type UserCreateInput = z.infer<typeof userCreateSchema>

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  // optional password reset
  password: z.string().min(8).max(128).optional().or(z.literal('')),
})

export type UserUpdateInput = z.infer<typeof userUpdateSchema>

// ── OCR confirmation (values extracted, confirmed by user) ──

export const ocrResultSchema = z.object({
  systolic: z.number().int().nullable(),
  diastolic: z.number().int().nullable(),
  pulse: z.number().int().nullable(),
  rawText: z.string(),
  imagePath: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  /** Engine that actually produced the result. */
  provider: z.string().optional(),
  /** Non-fatal warning, e.g. the chosen provider failed and we fell back. */
  warning: z.string().optional(),
})

export type OcrResult = z.infer<typeof ocrResultSchema>
