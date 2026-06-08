import { createFileRoute, redirect } from '@tanstack/react-router'

// The scan flow now lives on the unified "Add reading" page.
export const Route = createFileRoute('/_authed/ocr')({
  beforeLoad: () => {
    throw redirect({ to: '/records/new', search: { scan: true } })
  },
})
