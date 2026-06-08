import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAdmin } from '#/server/guards'
import { audit } from '#/lib/audit'
import {
  applySecret,
  getEffectiveOcr,
  listAnthropicModels,
  listOllamaModels,
  readOcrSettings,
  writeOcrSettings,
  type OcrSettings,
} from '#/server/ocr-settings'
import {
  getEffectiveSmtp,
  readSmtpSettings,
  writeSmtpSettings,
  type SmtpSettings,
} from '#/server/smtp-settings'
import { sendTest } from '#/lib/mailer'
import { testEmail } from '#/lib/email-templates'

export interface OcrSettingsView {
  provider: OcrSettings['provider']
  anthropicModel: string
  anthropicApiKeySet: boolean
  anthropicEnvKeySet: boolean
  ollamaHost: string
  ollamaApiKeySet: boolean
  ollamaEnvKeySet: boolean
  ollamaModel: string
  activeProvider: 'anthropic' | 'ollama' | 'tesseract'
}

/** Admin: current OCR settings with secrets masked to booleans. */
export const fetchOcrSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<OcrSettingsView> => {
    await requireAdmin()
    const s = await readOcrSettings()
    const eff = await getEffectiveOcr()
    return {
      provider: s.provider,
      anthropicModel: s.anthropicModel,
      anthropicApiKeySet: Boolean(s.anthropicApiKey),
      anthropicEnvKeySet: Boolean(process.env.ANTHROPIC_API_KEY),
      ollamaHost: s.ollamaHost,
      ollamaApiKeySet: Boolean(s.ollamaApiKey),
      ollamaEnvKeySet: Boolean(process.env.OLLAMA_API_KEY),
      ollamaModel: s.ollamaModel,
      activeProvider: eff.provider,
    }
  },
)

const saveSchema = z.object({
  provider: z.enum(['auto', 'anthropic', 'ollama', 'tesseract']),
  anthropicModel: z.string().trim().max(100).optional(),
  // '' = keep current, '__clear__' = clear, anything else = set
  anthropicApiKey: z.string().max(300).optional(),
  ollamaHost: z.string().trim().max(300).optional(),
  ollamaApiKey: z.string().max(300).optional(),
  ollamaModel: z.string().trim().max(100).optional(),
})

export const saveOcrSettings = createServerFn({ method: 'POST' })
  .validator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const admin = await requireAdmin()
    const cur = await readOcrSettings()
    const next: OcrSettings = {
      provider: data.provider,
      anthropicModel: data.anthropicModel ?? cur.anthropicModel,
      anthropicApiKey: applySecret(cur.anthropicApiKey, data.anthropicApiKey),
      ollamaHost: data.ollamaHost ?? cur.ollamaHost,
      ollamaApiKey: applySecret(cur.ollamaApiKey, data.ollamaApiKey),
      ollamaModel: data.ollamaModel ?? cur.ollamaModel,
    }
    await writeOcrSettings(next)
    await audit({
      userId: admin.id,
      action: 'update',
      entity: 'Setting',
      entityId: 'ocr',
      metadata: { provider: next.provider },
    })
    return { ok: true }
  })

/** Admin: quick auth/model check for a provider (no image, text ping). */
export const testOcrProvider = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ provider: z.enum(['anthropic', 'ollama']) }).parse(d),
  )
  .handler(
    async ({ data }): Promise<{ ok: boolean; message: string }> => {
      await requireAdmin()
      const eff = await getEffectiveOcr()
      try {
        if (data.provider === 'anthropic') {
          if (!eff.anthropic.apiKey) {
            return { ok: false, message: 'No Anthropic API key configured.' }
          }
          const Anthropic = (await import('@anthropic-ai/sdk')).default
          const client = new Anthropic({ apiKey: eff.anthropic.apiKey })
          const r = await client.messages.create({
            model: eff.anthropic.model,
            max_tokens: 16,
            messages: [{ role: 'user', content: 'Reply with the word: ok' }],
          })
          const reply = r.content
            .map((b) => (b.type === 'text' ? b.text : ''))
            .join('')
            .trim()
          return { ok: true, message: `${eff.anthropic.model} OK — replied: ${reply || 'ok'}` }
        }
        const { Ollama } = await import('ollama')
        const headers: Record<string, string> = {}
        if (eff.ollama.apiKey) headers.Authorization = `Bearer ${eff.ollama.apiKey}`
        const client = new Ollama({ host: eff.ollama.host, headers })
        const r = await client.chat({
          model: eff.ollama.model,
          stream: false,
          messages: [{ role: 'user', content: 'Reply with the word ok' }],
        })
        return {
          ok: true,
          message: `${eff.ollama.model} OK — replied: ${(r.message?.content || '').trim().slice(0, 80)}`,
        }
      } catch (e) {
        return { ok: false, message: (e as Error).message }
      }
    },
  )

/** Admin: list available models for a provider (uses effective host/key). */
export const listOcrModels = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ provider: z.enum(['anthropic', 'ollama']) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ models: Array<string> }> => {
    await requireAdmin()
    const eff = await getEffectiveOcr()
    const models =
      data.provider === 'anthropic'
        ? await listAnthropicModels(eff.anthropic.apiKey)
        : await listOllamaModels(eff.ollama.host, eff.ollama.apiKey)
    return { models }
  })

// ── SMTP / notifications ───────────────────────────────────

export interface SmtpSettingsView {
  notificationsEnabled: boolean
  host: string
  port: number | null
  secure: boolean
  user: string
  passSet: boolean
  envPassSet: boolean
  fromName: string
  fromEmail: string
  configured: boolean
}

export const fetchSmtpSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SmtpSettingsView> => {
    await requireAdmin()
    const s = await readSmtpSettings()
    const eff = await getEffectiveSmtp()
    return {
      notificationsEnabled: s.notificationsEnabled,
      host: s.host,
      port: s.port,
      secure: s.secure,
      user: s.user,
      passSet: Boolean(s.pass),
      envPassSet: Boolean(process.env.SMTP_PASS),
      fromName: s.fromName,
      fromEmail: s.fromEmail,
      configured: eff.configured,
    }
  },
)

const smtpSaveSchema = z.object({
  notificationsEnabled: z.boolean(),
  host: z.string().trim().max(255).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  secure: z.boolean().optional(),
  user: z.string().trim().max(255).optional(),
  pass: z.string().max(500).optional(),
  fromName: z.string().trim().max(120).optional(),
  fromEmail: z
    .string()
    .trim()
    .max(255)
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Invalid email'),
})

export const saveSmtpSettings = createServerFn({ method: 'POST' })
  .validator((d: unknown) => smtpSaveSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const admin = await requireAdmin()
    const cur = await readSmtpSettings()
    const next: SmtpSettings = {
      notificationsEnabled: data.notificationsEnabled,
      host: data.host ?? cur.host,
      port: data.port ?? cur.port,
      secure: data.secure ?? cur.secure,
      user: data.user ?? cur.user,
      pass: applySecret(cur.pass, data.pass),
      fromName: data.fromName ?? cur.fromName,
      fromEmail: data.fromEmail ?? cur.fromEmail,
    }
    await writeSmtpSettings(next)
    await audit({
      userId: admin.id,
      action: 'update',
      entity: 'Setting',
      entityId: 'smtp',
      metadata: { notificationsEnabled: next.notificationsEnabled },
    })
    return { ok: true }
  })

export const testSmtp = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ to: z.string().email() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    await requireAdmin()
    try {
      await sendTest({ to: data.to, ...testEmail() })
      return { ok: true, message: `Test email sent to ${data.to}.` }
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    }
  })
