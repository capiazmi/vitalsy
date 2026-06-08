import { downscaleForVision, parseBpFromText, type OcrOutcome } from '#/lib/ocr'

// OCR using an Ollama vision model — works with Ollama Cloud (ollama.com) or a
// self-hosted/local Ollama server.
//
//   OLLAMA_HOST       default https://ollama.com (Cloud). Set to http://localhost:11434 for local.
//   OLLAMA_API_KEY    required for Ollama Cloud (Bearer token from ollama.com); optional for local.
//   OLLAMA_OCR_MODEL  a vision-capable model, e.g. "qwen2.5vl" / "llama3.2-vision" — set to one
//                     available on your Ollama Cloud account or local install.

const PROMPT = `This image is a photo of a blood-pressure monitor's display.
Read the three values on the LCD:
- SYS (systolic) — the top, largest number
- DIA (diastolic) — the middle number
- PULSE (/min) — the bottom number, often next to a heart icon
Report each number exactly as shown. Seven-segment digits can be ambiguous — look
carefully (8 vs 6, 1 vs 7, 0 vs 8). If a value is missing or unreadable, return null
for that field. Do not guess wildly. Respond with ONLY a JSON object of the form
{"systolic": number|null, "diastolic": number|null, "pulse": number|null, "confidence": number}
where confidence is 0-100.`

// JSON schema for Ollama structured outputs.
const FORMAT = {
  type: 'object',
  properties: {
    systolic: { type: ['integer', 'null'] },
    diastolic: { type: ['integer', 'null'] },
    pulse: { type: ['integer', 'null'] },
    confidence: { type: 'number' },
  },
  required: ['systolic', 'diastolic', 'pulse', 'confidence'],
} as const

function toInt(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) ? n : null
}

export function isOllamaConfigured(): boolean {
  return Boolean(process.env.OLLAMA_API_KEY || process.env.OLLAMA_HOST)
}

export async function runOllamaOcr(
  image: Buffer,
  opts: { host?: string; apiKey?: string; model?: string } = {},
): Promise<OcrOutcome> {
  const { Ollama } = await import('ollama')

  const host = opts.host || process.env.OLLAMA_HOST || 'https://ollama.com'
  const apiKey = opts.apiKey || process.env.OLLAMA_API_KEY
  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const client = new Ollama({ host, headers })
  const model = opts.model || process.env.OLLAMA_OCR_MODEL || 'qwen2.5vl'

  // Shrink the photo before upload: smaller payload + fewer image tokens for
  // the model to prefill, which is the bulk of the round-trip latency.
  const { data: visionImage } = await downscaleForVision(image)

  const res = await client.chat({
    model,
    stream: false,
    messages: [
      { role: 'user', content: PROMPT, images: [visionImage.toString('base64')] },
    ],
    format: FORMAT,
    // temperature 0 for determinism; num_predict caps the tiny JSON output so a
    // stray long decode can't add latency.
    options: { temperature: 0, num_predict: 64 },
  })

  const text = res.message?.content ?? ''
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    // not valid JSON — fall back to text parsing below
  }

  let systolic = toInt(parsed.systolic)
  let diastolic = toInt(parsed.diastolic)
  let pulse = toInt(parsed.pulse)

  // If structured output gave nothing, salvage numbers from the raw text.
  if (systolic === null && diastolic === null) {
    const fb = parseBpFromText(text)
    systolic = fb.systolic
    diastolic = fb.diastolic
    pulse = pulse ?? fb.pulse
  }

  return {
    systolic,
    diastolic,
    pulse,
    rawText: text,
    confidence: Number(parsed.confidence) || 0,
  }
}
