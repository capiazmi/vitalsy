import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { isAdmin } from '#/lib/roles'

export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: ({ context }) => {
    if (!isAdmin(context.user.role)) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: () => <Outlet />,
})
