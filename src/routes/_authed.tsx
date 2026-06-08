import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { fetchSession } from '#/server/session'
import { AppShell } from '#/components/layout/app-shell'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const user = await fetchSession()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    return { user }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  )
}
