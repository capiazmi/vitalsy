import type { Area } from 'react-easy-crop'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Largest edge (px) the cropped image is downscaled to before encoding. */
const MAX_EDGE = 1600
/** JPEG quality used when encoding the crop. */
const JPEG_QUALITY = 0.85

/**
 * Crops `imageSrc` to the given pixel area (in original-image coordinates),
 * downscales it so its longest edge is at most `MAX_EDGE`, and encodes it as
 * JPEG. JPEG + downscaling keeps the upload far below the server's size cap;
 * a raw PNG crop from a high-resolution phone camera can easily exceed it.
 */
export async function getCroppedBlob(
  imageSrc: string,
  area: Area,
): Promise<Blob> {
  const image = await loadImage(imageSrc)

  const srcW = Math.max(1, Math.round(area.width))
  const srcH = Math.max(1, Math.round(area.height))
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH))

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(srcW * scale))
  canvas.height = Math.max(1, Math.round(srcH * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Crop failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}
