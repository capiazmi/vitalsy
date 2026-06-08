import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { downscaleForVision, type OcrOutcome } from '#/lib/ocr'

// AI-powered OCR using Claude vision. Reads 7-segment LCD photos far more
// reliably than classic OCR. Returns structured values directly.
//
// Requires ANTHROPIC_API_KEY. Model defaults to claude-opus-4-8 (most accurate);
// override with ANTHROPIC_OCR_MODEL (e.g. claude-haiku-4-5 to cut cost).

const BpExtraction = z.object({
  systolic: z
    .number()
    .int()
    .nullable()
    .describe('Top/large SYS number in mmHg, or null if unreadable'),
  diastolic: z
    .number()
    .int()
    .nullable()
    .describe('Middle DIA number in mmHg, or null if unreadable'),
  pulse: z
    .number()
    .int()
    .nullable()
    .describe('Bottom PULSE/min number, or null if unreadable'),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe('How confident you are in the reading, 0-100'),
})

const PROMPT = `This image is a photo of a blood-pressure monitor's display.
Read the three values shown on the LCD:
- SYS (systolic) — the top, largest number
- DIA (diastolic) — the middle number
- PULSE (/min) — the bottom number, often next to a heart icon
Report each number exactly as shown on the display. Seven-segment digits can be
ambiguous — look carefully (e.g. distinguish 8 vs 6, 1 vs 7, 0 vs 8). If a value
is missing or you genuinely cannot read it, return null for that field. Do not
guess wildly. Provide a confidence score.`

export function isAiOcrConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export async function runAiOcr(
  image: Buffer,
  mediaType = 'image/png',
  opts: { apiKey?: string; model?: string } = {},
): Promise<OcrOutcome> {
  // Falls back to ANTHROPIC_API_KEY from env when no apiKey is passed.
  const client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {})
  const model =
    opts.model || process.env.ANTHROPIC_OCR_MODEL || 'claude-opus-4-8'

  // Shrink before upload: fewer image tokens to prefill = faster + cheaper,
  // with no loss that matters for reading large seven-segment digits. The
  // helper re-encodes as JPEG; if it fails it returns the original bytes and
  // we fall back to the caller's media type.
  const { data: visionImage, mediaType: visionType } = await downscaleForVision(
    image,
    mediaType,
  )
  const media = (
    ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(visionType)
      ? visionType
      : 'image/png'
  ) as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

  const response = await client.messages.parse({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: media,
              data: visionImage.toString('base64'),
            },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(BpExtraction) },
  })

  const out = response.parsed_output
  return {
    systolic: out?.systolic ?? null,
    diastolic: out?.diastolic ?? null,
    pulse: out?.pulse ?? null,
    rawText: out ? JSON.stringify(out) : '',
    confidence: out?.confidence ?? 0,
  }
}
