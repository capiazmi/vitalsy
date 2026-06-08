import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListPlus } from 'lucide-react'
import { toast } from 'sonner'
import { recordsQueryOptions } from '#/lib/queries'
import { isAdmin } from '#/lib/roles'
import { deleteRecord } from '#/server/records'
import type { RecordsQuery } from '#/lib/validation'
import { PageHeader } from '#/components/page-header'
import { RangeFilter } from '#/components/bp/range-filter'
import { BpChart } from '#/components/bp/bp-chart'
import { RecordsTable } from '#/components/bp/records-table'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Switch } from '#/components/ui/switch'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/_authed/records/')({
  component: RecordsPage,
})

function RecordsPage() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const [showPulse, setShowPulse] = useState(false)
  const [filter, setFilter] = useState<RecordsQuery>({ range: '30' })

  // Restrict to the signed-in user's own readings (admins use /admin/readings
  // to view everyone).
  const params: RecordsQuery = useMemo(
    () => ({ ...filter, userId: isAdmin(user.role) ? user.id : undefined }),
    [filter, user.id, user.role],
  )

  const { data: records, isLoading } = useQuery(recordsQueryOptions(params))

  const del = useMutation({
    mutationFn: (id: string) => deleteRecord({ data: { id } }),
    onSuccess: () => {
      toast.success('Reading deleted')
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="History"
        description="Your blood pressure readings over time."
        action={
          <Button asChild size="sm">
            <Link to="/records/new">
              <ListPlus className="mr-1.5 h-4 w-4" /> Add reading
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <RangeFilter value={filter} onChange={setFilter} />
        <div className="flex items-center gap-2">
          <Switch
            id="pulse"
            checked={showPulse}
            onCheckedChange={setShowPulse}
          />
          <Label htmlFor="pulse" className="text-sm">
            Show pulse
          </Label>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !records ? (
            <Skeleton className="h-64" />
          ) : (
            <BpChart records={records} showPulse={showPulse} />
          )}
        </CardContent>
      </Card>

      {isLoading || !records ? (
        <Skeleton className="h-48" />
      ) : (
        <RecordsTable
          records={records}
          onDelete={(id) => del.mutate(id)}
          deletingId={del.isPending ? del.variables : null}
        />
      )}
    </div>
  )
}
