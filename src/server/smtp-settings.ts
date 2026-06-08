import { prisma } from '#/db'
import type { Prisma } from '#/generated/prisma/client.js'

// Server-only SMTP / notification settings. Stored in the Setting table under
// key "smtp". DB values take precedence over environment variables.

const SMTP_KEY = 'smtp'

export interface SmtpSettings {
  notificationsEnabled: boolean
  host: string
  port: number | null
  secure: boolean
  user: string
  pass: string | null
  fromName: string
  fromEmail: string
}

const DEFAULTS: SmtpSettings = {
  notificationsEnabled: false,
  host: '',
  port: null,
  secure: false,
  user: '',
  pass: null,
  fromName: 'BP Monitor',
  fromEmail: '',
}

export async function readSmtpSettings(): Promise<SmtpSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SMTP_KEY } })
  const stored = (row?.value as Partial<SmtpSettings> | undefined) ?? {}
  return { ...DEFAULTS, ...stored }
}

export async function writeSmtpSettings(value: SmtpSettings): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SMTP_KEY },
    create: { key: SMTP_KEY, value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  })
}

export interface EffectiveSmtp {
  /** SMTP host + from address present (can send a test). */
  configured: boolean
  /** configured AND the master notifications toggle is on. */
  notificationsEnabled: boolean
  host: string
  port: number
  secure: boolean
  user?: string
  pass?: string
  fromName: string
  fromEmail: string
}

export async function getEffectiveSmtp(): Promise<EffectiveSmtp> {
  const s = await readSmtpSettings()
  const envBool = (v: string | undefined) => v === 'true' || v === '1'

  const host = s.host || process.env.SMTP_HOST || ''
  const port =
    s.port ?? (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587)
  const secure = s.secure || envBool(process.env.SMTP_SECURE)
  const user = s.user || process.env.SMTP_USER || ''
  const pass = s.pass || process.env.SMTP_PASS || ''
  const fromName = s.fromName || process.env.SMTP_FROM_NAME || 'BP Monitor'
  const fromEmail = s.fromEmail || process.env.SMTP_FROM_EMAIL || user

  const configured = Boolean(host && fromEmail)
  const masterOn =
    s.notificationsEnabled || envBool(process.env.NOTIFICATIONS_ENABLED)

  return {
    configured,
    notificationsEnabled: configured && masterOn,
    host,
    port,
    secure,
    user: user || undefined,
    pass: pass || undefined,
    fromName,
    fromEmail,
  }
}

export function applySecret(
  current: string | null,
  incoming: string | undefined,
): string | null {
  if (incoming === undefined || incoming === '') return current
  if (incoming === '__clear__') return null
  return incoming
}
