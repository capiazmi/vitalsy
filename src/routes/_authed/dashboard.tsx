import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Activity, Gauge, HeartPulse, ListPlus, ScanLine, Users } from 'lucide-react'
import {
  adminDashboardQueryOptions,
  userDashboardQueryOptions,
} from '#/lib/queries'
import { isAdmin } from '#/lib/roles'
import { bpStatus } from '#/lib/bp-utils'
import { PageHeader } from '#/components/page-header'
import { StatCard } from '#/components/stat-card'
import { BpStatusBadge } from '#/components/bp/bp-status-badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/_authed/dashboard')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(userDashboardQueryOptions())
    if (isAdmin(context.user.role)) {
      await context.queryClient.ensureQueryData(adminDashboardQueryOptions())
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = Route.useRouteContext()
  const admin = isAdmin(user.role)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hi, ${user.name.split(' ')[0]}`}
        description="Here's your blood pressure overview."
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/records/new" search={{ scan: true }}>
                <ScanLine className="mr-1.5 h-4 w-4" /> Scan
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/records/new">
                <ListPlus className="mr-1.5 h-4 w-4" /> Add reading
              </Link>
            </Button>
          </>
        }
      />

      <UserOverview />
      {admin && <AdminOverview />}
    </div>
  )
}

function UserOverview() {
  const { data, isLoading } = useQuery(userDashboardQueryOptions())

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  const latest = data.latest
  const status = latest ? bpStatus(latest.systolic, latest.diastolic) : null

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Latest"
          value={latest ? `${latest.systolic}/${latest.diastolic}` : '—'}
          hint={
            latest
              ? format(new Date(latest.recordedAt), 'MMM d, HH:mm')
              : 'No readings yet'
          }
          icon={<HeartPulse className="h-5 w-5" />}
        />
        <StatCard
          label="Avg systolic"
          value={data.avgSystolic ?? '—'}
          hint="mmHg"
          icon={<Gauge className="h-5 w-5" />}
        />
        <StatCard
          label="Avg diastolic"
          value={data.avgDiastolic ?? '—'}
          hint="mmHg"
          icon={<Gauge className="h-5 w-5" />}
        />
        <StatCard
          label="Readings"
          value={data.count}
          hint="recorded total"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      {latest && status && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Latest status</CardDescription>
            <CardTitle className="flex items-center gap-3 text-xl">
              {latest.systolic}/{latest.diastolic}
              <BpStatusBadge
                systolic={latest.systolic}
                diastolic={latest.diastolic}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Based on the ACC/AHA categories. This is informational only and not
            medical advice.
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function AdminOverview() {
  const { data, isLoading } = useQuery(adminDashboardQueryOptions())

  if (isLoading || !data) {
    return <Skeleton className="h-40" />
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Admin overview</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Total users"
          value={data.totalUsers}
          hint={`${data.activeUsers} active`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Total readings"
          value={data.totalReadings}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard label="Recent (24h shown)" value={data.recent.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent readings</CardTitle>
          <CardDescription>Across all users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No readings yet.</p>
          ) : (
            data.recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.user?.name ?? '—'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {format(new Date(r.recordedAt), 'MMM d, HH:mm')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">
                    {r.systolic}/{r.diastolic}
                  </span>
                  <BpStatusBadge systolic={r.systolic} diastolic={r.diastolic} />
                </div>
              </div>
            ))
          )}
          <div className="pt-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/readings">View all readings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
