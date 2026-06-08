import { createServerFn } from '@tanstack/react-start'
import { requireUser } from '#/server/guards'
import { runOcr } from '#/lib/ocr'
import { runAiOcr } from '#/lib/ocr-ai'
import { runOllamaOcr } from '#/lib/ocr-ollama'
import { getEffectiveOcr } from '#/server/ocr-settings'
import { audit } from '#/lib/audit'
import type { OcrResult } from '#/lib/validation'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * Accepts an uploaded (cropped) image (FormData field `image`), runs OCR, and
 * returns extracted values for the user to confirm.
 *
 * IMPORTANT: this does NOT store the image. The image is only uploaded to S3
 * when the record is actually saved (see `createRecordFromScan`), so abandoned
 * scans never leave orphaned objects in the bucket.
 */
export const processOcr = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error('Expected multipart form data')
    }
    return data
  })
  .handler(async ({ data }): Promise<OcrResult> => {
    const user = await requireUser()

    const file = data.get('image')
    if (!(file instanceof File)) throw new Error('No image uploaded')
    if (file.size === 0) throw new Error('Uploaded image is empty')
    if (file.size > MAX_BYTES) throw new Error('Image is too large (max 8 MB)')
    if (!file.type.startsWith('image/')) {
      throw new Error('Uploaded file is not an image')
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const eff = await getEffectiveOcr()
    const requested = eff.provider
    let usedProvider = requested
    let warning: string | undefined
    let outcome
    try {
      if (requested === 'anthropic') {
        outcome = await runAiOcr(buffer, file.type || 'image/png', eff.anthropic)
      } else if (requested === 'ollama') {
        outcome = await runOllamaOcr(buffer, eff.ollama)
      } else {
        outcome = await runOcr(buffer)
      }
    } catch (err) {
      // If an AI provider fails (network/key/quota), fall back to offline OCR
      // but surface why, so it isn't a silent downgrade.
      if (requested !== 'tesseract') {
        const msg = (err as Error)?.message ?? 'unknown error'
        console.error(`[ocr] ${requested} failed, falling back to tesseract`, err)
        warning = `${requested} OCR failed (${msg}). Used the offline reader instead — check Settings.`
        usedProvider = 'tesseract'
        outcome = await runOcr(buffer)
      } else {
        throw err
      }
    }

    await audit({
      userId: user.id,
      action: 'ocr',
      entity: 'BloodPressureRecord',
      metadata: { requested, usedProvider, confidence: outcome.confidence },
    })

    return {
      systolic: outcome.systolic,
      diastolic: outcome.diastolic,
      pulse: outcome.pulse,
      rawText: outcome.rawText,
      confidence: outcome.confidence,
      provider: usedProvider,
      warning,
    }
  })
