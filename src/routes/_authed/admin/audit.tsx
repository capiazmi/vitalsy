import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { listAuditLogs } from '#/server/audit-log'
import { PageHeader } from '#/components/page-header'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Label } from '#/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

const ALL = '__all__'
const ACTIONS = [
  'login',
  'create',
  'update',
  'delete',
  'enable',
  'disable',
  'ocr',
] as const

const actionStyle: Record<string, string> = {
  login: 'bg-teal-100 text-teal-700',
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  disable: 'bg-amber-100 text-amber-700',
  enable: 'bg-emerald-100 text-emerald-700',
  ocr: 'bg-violet-100 text-violet-700',
}

export const Route = createFileRoute('/_authed/admin/audit')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ['audit', null],
      queryFn: () => listAuditLogs({ data: {} }),
    }),
  component: AuditPage,
})

function ActionBadge({ action }: { action: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${actionStyle[action] ?? 'bg-muted text-muted-foreground'}`}
    >
      {action}
    </span>
  )
}

function AuditPage() {
  const [action, setAction] = useState<string>(ALL)
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', action === ALL ? null : action],
    queryFn: () =>
      listAuditLogs({ data: action === ALL ? {} : { action } }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Recent activity — sign-ins and changes."
      />

      <div className="space-y-1.5">
        <Label className="text-xs">Action</Label>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading || !logs ? (
        <Skeleton className="h-64" />
      ) : logs.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No activity yet.
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden">
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <ActionBadge action={l.action} />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(l.createdAt), 'MMM d · HH:mm')}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium">
                  {l.user?.name ?? 'System'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.entity}
                  {l.user?.email ? ` · ${l.user.email}` : ''}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border bg-card sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(l.createdAt), 'MMM d, yyyy · HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={l.action} />
                    </TableCell>
                    <TableCell>
                      {l.user ? (
                        <div>
                          <p className="font-medium">{l.user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.user.email}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.entity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
