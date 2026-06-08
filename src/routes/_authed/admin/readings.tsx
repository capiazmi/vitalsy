import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { recordsQueryOptions, usersQueryOptions } from '#/lib/queries'
import { deleteRecord } from '#/server/records'
import type { RecordsQuery } from '#/lib/validation'
import { PageHeader } from '#/components/page-header'
import { RangeFilter } from '#/components/bp/range-filter'
import { RecordsTable } from '#/components/bp/records-table'
import { BpChart } from '#/components/bp/bp-chart'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

const ALL = '__all__'

export const Route = createFileRoute('/_authed/admin/readings')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(usersQueryOptions()),
  component: AdminReadingsPage,
})

function AdminReadingsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<RecordsQuery>({ range: '30' })
  const [userId, setUserId] = useState<string>(ALL)

  const { data: users } = useQuery(usersQueryOptions())
  const params: RecordsQuery = {
    ...filter,
    userId: userId === ALL ? undefined : userId,
  }
  const { data: records, isLoading } = useQuery(recordsQueryOptions(params))

  const del = useMutation({
    mutationFn: (id: string) => deleteRecord({ data: { id } }),
    onSuccess: () => {
      toast.success('Reading deleted')
      queryClient.invalidateQueries({ queryKey: ['records'] })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="All readings"
        description="Every blood pressure reading across users."
      />

      <div className="flex flex-wrap items-end gap-3">
        <RangeFilter value={filter} onChange={setFilter} />
        <div className="space-y-1.5">
          <Label className="text-xs">User</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All users</SelectItem>
              {users?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {userId !== ALL && records && records.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <BpChart records={records} showPulse />
          </CardContent>
        </Card>
      )}

      {isLoading || !records ? (
        <Skeleton className="h-64" />
      ) : (
        <RecordsTable
          records={records}
          showUser={userId === ALL}
          onDelete={(id) => del.mutate(id)}
          deletingId={del.isPending ? del.variables : null}
        />
      )}
    </div>
  )
}
