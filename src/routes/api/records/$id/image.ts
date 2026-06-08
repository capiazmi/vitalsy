import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/db'
import { auth } from '#/lib/auth'
import { getObject } from '#/lib/s3'
import { ROLES } from '#/lib/roles'

// Streams a record's stored source image from S3 through the app, so private
// buckets (and internal-only S3 endpoints) work. Auth + ownership enforced.
export const Route = createFileRoute('/api/records/$id/image')({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session?.user) return new Response('Unauthorized', { status: 401 })

        const id = params?.id ?? new URL(request.url).pathname.split('/').at(-2)
        if (!id) return new Response('Bad request', { status: 400 })

        const record = await prisma.bloodPressureRecord.findUnique({
          where: { id },
          select: { userId: true, imagePath: true },
        })
        if (!record?.imagePath) return new Response('Not found', { status: 404 })

        const role = (session.user as { role?: string }).role
        if (role !== ROLES.ADMIN && record.userId !== session.user.id) {
          return new Response('Forbidden', { status: 403 })
        }

        const obj = await getObject(record.imagePath)
        if (!obj) return new Response('Not found', { status: 404 })

        return new Response(obj.body as unknown as BodyInit, {
          headers: {
            'content-type': obj.contentType,
            'cache-control': 'private, max-age=3600',
          },
        })
      },
    },
  },
})
