import os from 'node:os'
import path from 'node:path'

// Simple, swappable OCR for blood-pressure monitor photos.
//
// Pipeline: preprocess (grayscale → upscale → blur → threshold) then recognise
// with a seven-segment Tesseract model (`ssd`), falling back to `eng`.
//
// To replace the engine later (e.g. a cloud vision API), implement `OcrEngine`
// and pass it to `runOcr`. Works best on a tight, straight, well-lit photo of
// just the display — values are always shown for confirmation before saving.

export interface OcrEngineResult {
  text: string
  confidence: number
}

export interface OcrEngine {
  recognize(image: Buffer): Promise<OcrEngineResult>
}

export interface ParsedBp {
  systolic: number | null
  diastolic: number | null
  pulse: number | null
}

export interface OcrOutcome extends ParsedBp {
  rawText: string
  confidence: number
}

const RANGES = {
  systolic: [70, 260] as const,
  diastolic: [40, 160] as const,
  pulse: [30, 220] as const,
}

/**
 * Heuristic parser: BP monitors display SYS, DIA, then PULSE top-to-bottom.
 * We read the numbers in order and assign them to the first slot whose range
 * they fit. Intentionally simple and easy to tune.
 */
export function parseBpFromText(text: string): ParsedBp {
  const numbers = (text.match(/\d{2,3}/g) ?? [])
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n))

  const inRange = (n: number, [lo, hi]: readonly [number, number]) =>
    n >= lo && n <= hi

  let systolic: number | null = null
  let diastolic: number | null = null
  let pulse: number | null = null

  for (const n of numbers) {
    if (systolic === null && inRange(n, RANGES.systolic)) systolic = n
    else if (diastolic === null && inRange(n, RANGES.diastolic)) diastolic = n
    else if (pulse === null && inRange(n, RANGES.pulse)) pulse = n
  }

  if (systolic !== null && diastolic !== null && diastolic > systolic) {
    ;[systolic, diastolic] = [diastolic, systolic]
  }

  return { systolic, diastolic, pulse }
}

/** Computes an Otsu threshold (0–255) from a greyscale histogram. */
function otsuThreshold(hist: Array<number>, total: number): number {
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0
  let wB = 0
  let maxVar = 0
  let threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > maxVar) {
      maxVar = between
      threshold = t
    }
  }
  return threshold
}

/**
 * Binarise the image so seven-segment digits become solid black on white.
 * Upscales small crops, denoises with a light blur, then applies an Otsu
 * threshold (adapts to the photo's lighting).
 */
export async function preprocess(input: Buffer): Promise<Buffer> {
  const { Jimp } = await import('jimp')
  const img = await Jimp.read(input)

  const targetWidth = 1100
  if (img.bitmap.width < targetWidth) {
    img.scale(targetWidth / img.bitmap.width)
  }

  img.greyscale().contrast(0.2).blur(2)

  const data = img.bitmap.data
  const total = data.length / 4
  const hist = new Array(256).fill(0)
  for (let i = 0; i < data.length; i += 4) hist[data[i]]++

  const threshold = otsuThreshold(hist, total)
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] < threshold ? 0 : 255
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }

  return img.getBuffer('image/png')
}

/**
 * Downscale a photo for vision-model OCR (Ollama / Claude). Shrinks the long
 * edge to `maxEdge` and re-encodes as JPEG, which cuts both the upload size and
 * the model's image-token prefill — the bulk of the latency for a cloud vision
 * call — with no loss that matters for reading large seven-segment digits.
 *
 * Unlike `preprocess`, this does NOT binarise: vision models read the colour
 * photo directly. Returns the original buffer untouched if anything fails.
 */
export async function downscaleForVision(
  input: Buffer,
  fallbackMediaType = 'image/jpeg',
  maxEdge = 1024,
): Promise<{ data: Buffer; mediaType: string }> {
  try {
    const { Jimp } = await import('jimp')
    const img = await Jimp.read(input)
    const longEdge = Math.max(img.bitmap.width, img.bitmap.height)
    if (longEdge > maxEdge) {
      img.scale(maxEdge / longEdge)
    }
    const data = await img.getBuffer('image/jpeg', { quality: 82 })
    return { data, mediaType: 'image/jpeg' }
  } catch {
    return { data: input, mediaType: fallbackMediaType }
  }
}

/** Lazily-loaded tesseract.js engine (kept out of the client bundle). */
class TesseractEngine implements OcrEngine {
  async recognize(image: Buffer): Promise<OcrEngineResult> {
    const { createWorker } = await import('tesseract.js')

    const tessdataPath = path.resolve(
      process.env.OCR_TESSDATA_PATH ?? 'tessdata',
    )
    const lang = process.env.OCR_LANG ?? 'ssd'

    // Prefer the seven-segment model; fall back to the bundled English model.
    let worker: Awaited<ReturnType<typeof createWorker>>
    try {
      worker = await createWorker(lang, 1, {
        langPath: tessdataPath,
        gzip: false,
        cachePath: os.tmpdir(),
      })
    } catch {
      worker = await createWorker('eng')
    }

    try {
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '6' as never,
      })
      const { data } = await worker.recognize(image)
      return { text: data.text ?? '', confidence: data.confidence ?? 0 }
    } finally {
      await worker.terminate()
    }
  }
}

let defaultEngine: OcrEngine | null = null

export function getOcrEngine(): OcrEngine {
  if (!defaultEngine) defaultEngine = new TesseractEngine()
  return defaultEngine
}

/** Preprocess an image, run OCR, and parse BP values out of it. */
export async function runOcr(
  image: Buffer,
  engine: OcrEngine = getOcrEngine(),
): Promise<OcrOutcome> {
  let processed = image
  try {
    processed = await preprocess(image)
  } catch {
    // If preprocessing fails, fall back to the original image.
  }
  const { text, confidence } = await engine.recognize(processed)
  return { rawText: text, confidence, ...parseBpFromText(text) }
}
