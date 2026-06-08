import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'

// External S3 (or S3-compatible) storage for OCR source images.
// All config comes from env. If unconfigured, uploads are skipped gracefully.

let cached: S3Client | null | undefined

export function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  )
}

function getClient(): S3Client | null {
  if (cached !== undefined) return cached
  if (!isS3Configured()) {
    cached = null
    return null
  }

  const config: S3ClientConfig = {
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  }
  if (process.env.S3_ENDPOINT) config.endpoint = process.env.S3_ENDPOINT

  cached = new S3Client(config)
  return cached
}

/**
 * Uploads an image buffer to S3 and returns the stored object key,
 * or null if S3 is not configured.
 */
export async function uploadImage(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<string | null> {
  const client = getClient()
  if (!client) return null

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
  return key
}

/**
 * Fetches an object from S3 (server-side, with credentials). Returns the bytes
 * and content type, or null if S3 isn't configured / the object is missing.
 */
export async function getObject(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  const client = getClient()
  if (!client) return null
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
    )
    if (!res.Body) return null
    const body = await res.Body.transformToByteArray()
    return { body, contentType: res.ContentType ?? 'application/octet-stream' }
  } catch {
    return null
  }
}

/**
 * Builds a public URL for a stored object key, if a base URL is configured.
 *
 * Uses path-style URLs (`<base>/<bucket>/<key>`) to match `forcePathStyle`.
 * Set `S3_PUBLIC_URL` to the public endpoint/host — the bucket + key are
 * appended automatically. Note: the object must be publicly readable for this
 * link to resolve; private buckets return 403 (see README on presigned URLs).
 */
export function publicUrl(key: string | null | undefined): string | null {
  if (!key) return null
  const base = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT)?.replace(
    /\/+$/,
    '',
  )
  if (!base) return null
  const bucket = process.env.S3_BUCKET
  return bucket ? `${base}/${bucket}/${key}` : `${base}/${key}`
}
