import { Link, useRouter } from '@tanstack/react-router'
import {
  HeartPulse,
  LayoutDashboard,
  ListPlus,
  Users,
  Activity,
  Settings,
  Mail,
  ScrollText,
  LogOut,
} from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { isAdmin, roleLabel } from '#/lib/roles'
import type { SessionUser } from '#/server/session'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Avatar,
  AvatarFallback,
} from '#/components/ui/avatar'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  admin?: boolean
}

const NAV: Array<NavItem> = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/records', label: 'Records', icon: Activity },
  { to: '/records/new', label: 'Add', icon: ListPlus },
  { to: '/admin/users', label: 'Users', icon: Users, admin: true },
  { to: '/admin/readings', label: 'Readings', icon: Activity, admin: true },
  { to: '/admin/audit', label: 'Audit', icon: ScrollText, admin: true },
  { to: '/admin/email', label: 'Email', icon: Mail, admin: true },
  { to: '/admin/settings', label: 'Settings', icon: Settings, admin: true },
]

export function AppShell({
  user,
  children,
}: {
  user: SessionUser
  children: React.ReactNode
}) {
  const router = useRouter()
  const admin = isAdmin(user.role)
  const items = NAV.filter((i) => !i.admin || admin)
  const coreItems = NAV.filter((i) => !i.admin)
  const adminItems = admin ? NAV.filter((i) => i.admin) : []

  async function signOut() {
    await authClient.signOut()
    await router.invalidate()
    await router.navigate({ to: '/login' })
  }

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-dvh">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">BP Monitor</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: 'bg-muted text-foreground' }}
                activeOptions={{ exact: item.to === '/records' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-teal-100 text-xs text-teal-800">
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[8rem] truncate text-sm sm:inline">
                  {user.name}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="truncate">{user.name}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                  <span className="mt-1 text-xs font-normal text-teal-700">
                    {roleLabel(user.role)}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {adminItems.length > 0 && (
                <>
                  {adminItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link to={item.to}>
                          <Icon className="mr-2 h-4 w-4" /> {item.label}
                        </Link>
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:pb-10">{children}</main>

      {/* Mobile bottom nav — core actions; admin pages live in the avatar menu */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl">
          {coreItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground"
                activeProps={{ className: 'text-teal-700' }}
                activeOptions={{ exact: item.to === '/records' }}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn('h-5 w-5', isActive && 'text-teal-700')}
                    />
                    {item.label}
                  </>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
