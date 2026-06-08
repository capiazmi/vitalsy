import { prisma } from '#/db'
import type { Prisma } from '#/generated/prisma/client.js'

// Server-only OCR settings helpers. Stored in the Setting table under key "ocr".
// DB values take precedence over environment variables; env is the fallback.

const OCR_KEY = 'ocr'

export type OcrProviderChoice = 'auto' | 'anthropic' | 'ollama' | 'tesseract'

export interface OcrSettings {
  provider: OcrProviderChoice
  anthropicModel: string
  anthropicApiKey: string | null
  ollamaHost: string
  ollamaApiKey: string | null
  ollamaModel: string
}

const DEFAULTS: OcrSettings = {
  provider: 'auto',
  anthropicModel: '',
  anthropicApiKey: null,
  ollamaHost: '',
  ollamaApiKey: null,
  ollamaModel: '',
}

/** Raw settings (includes secrets) — never send this to the client unmasked. */
export async function readOcrSettings(): Promise<OcrSettings> {
  const row = await prisma.setting.findUnique({ where: { key: OCR_KEY } })
  const stored = (row?.value as Partial<OcrSettings> | undefined) ?? {}
  return { ...DEFAULTS, ...stored }
}

export async function writeOcrSettings(value: OcrSettings): Promise<void> {
  await prisma.setting.upsert({
    where: { key: OCR_KEY },
    create: { key: OCR_KEY, value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  })
}

export interface EffectiveOcr {
  provider: 'anthropic' | 'ollama' | 'tesseract'
  anthropic: { apiKey?: string; model: string }
  ollama: { host: string; apiKey?: string; model: string }
}

/** Merge DB settings over environment variables and resolve the active provider. */
export async function getEffectiveOcr(): Promise<EffectiveOcr> {
  const s = await readOcrSettings()

  const anthropicApiKey =
    s.anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined
  const anthropicModel =
    s.anthropicModel || process.env.ANTHROPIC_OCR_MODEL || 'claude-opus-4-8'

  const ollamaHost = s.ollamaHost || process.env.OLLAMA_HOST || 'https://ollama.com'
  const ollamaApiKey = s.ollamaApiKey || process.env.OLLAMA_API_KEY || undefined
  const ollamaModel = s.ollamaModel || process.env.OLLAMA_OCR_MODEL || 'qwen2.5vl'

  const explicit = s.provider !== 'auto' ? s.provider : process.env.OCR_PROVIDER
  let provider: EffectiveOcr['provider']
  if (explicit === 'anthropic' || explicit === 'ollama' || explicit === 'tesseract') {
    provider = explicit
  } else if (anthropicApiKey) {
    provider = 'anthropic'
  } else if (ollamaApiKey || s.ollamaHost || process.env.OLLAMA_HOST) {
    provider = 'ollama'
  } else {
    provider = 'tesseract'
  }

  return {
    provider,
    anthropic: { apiKey: anthropicApiKey, model: anthropicModel },
    ollama: { host: ollamaHost, apiKey: ollamaApiKey, model: ollamaModel },
  }
}

/** Apply an incoming secret edit: undefined/'' keep current, '__clear__' clears. */
export function applySecret(
  current: string | null,
  incoming: string | undefined,
): string | null {
  if (incoming === undefined || incoming === '') return current
  if (incoming === '__clear__') return null
  return incoming
}

const ANTHROPIC_FALLBACK = [
  'claude-opus-4-8',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
]

export async function listAnthropicModels(apiKey?: string): Promise<Array<string>> {
  if (!apiKey) return ANTHROPIC_FALLBACK
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })
    const ids: Array<string> = []
    for await (const m of client.models.list()) ids.push(m.id)
    return ids.length ? ids : ANTHROPIC_FALLBACK
  } catch {
    return ANTHROPIC_FALLBACK
  }
}

export async function listOllamaModels(
  host: string,
  apiKey?: string,
): Promise<Array<string>> {
  try {
    const { Ollama } = await import('ollama')
    const headers: Record<string, string> = {}
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const client = new Ollama({ host, headers })
    const res = await client.list()
    return (res.models ?? [])
      .map((m) => (m as { name?: string; model?: string }).name ?? (m as { model?: string }).model)
      .filter((x): x is string => Boolean(x))
  } catch {
    return []
  }
}
