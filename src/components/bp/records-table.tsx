import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { ArrowUpDown, Eye, Trash2 } from 'lucide-react'
import type { SerializedRecord } from '#/server/records'
import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { BpStatusBadge } from '#/components/bp/bp-status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'

const col = createColumnHelper<SerializedRecord>()

function RowActions({
  record,
  onDelete,
  deletingId,
}: {
  record: SerializedRecord
  onDelete?: (id: string) => void
  deletingId?: string | null
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
        <Link to="/records/$id" params={{ id: record.id }}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              disabled={deletingId === record.id}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this reading?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(record.id)}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

export function RecordsTable({
  records,
  showUser = false,
  onDelete,
  deletingId,
}: {
  records: Array<SerializedRecord>
  showUser?: boolean
  onDelete?: (id: string) => void
  deletingId?: string | null
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'recordedAt', desc: true },
  ])

  const columns = useMemo(() => {
    const base = [
      col.accessor('recordedAt', {
        header: 'Date',
        cell: (c) => (
          <span className="whitespace-nowrap">
            {format(new Date(c.getValue()), 'MMM d, yyyy · HH:mm')}
          </span>
        ),
        sortingFn: 'datetime',
      }),
      col.display({
        id: 'bp',
        header: 'BP',
        cell: (c) => (
          <span className="font-semibold tabular-nums">
            {c.row.original.systolic}/{c.row.original.diastolic}
          </span>
        ),
      }),
      col.accessor('pulse', {
        header: 'Pulse',
        cell: (c) => c.getValue() ?? '—',
      }),
      col.display({
        id: 'status',
        header: 'Status',
        cell: (c) => (
          <BpStatusBadge
            systolic={c.row.original.systolic}
            diastolic={c.row.original.diastolic}
          />
        ),
      }),
      col.accessor('notes', {
        header: 'Notes',
        cell: (c) => (
          <span className="line-clamp-1 max-w-[14rem] text-muted-foreground">
            {c.getValue() || '—'}
          </span>
        ),
      }),
    ]

    const userCol = col.accessor((r) => r.user?.name ?? '—', {
      id: 'user',
      header: 'User',
      cell: (c) => (
        <span className="whitespace-nowrap">{c.getValue() as string}</span>
      ),
    })

    const actions = col.display({
      id: 'actions',
      header: '',
      cell: (c) => (
        <RowActions
          record={c.row.original}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ),
    })

    return showUser
      ? [base[0], userCol, ...base.slice(1), actions]
      : [...base, actions]
  }, [showUser, onDelete, deletingId])

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows

  return (
    <>
      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {rows.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            No readings found.
          </p>
        ) : (
          rows.map((row) => {
            const r = row.original
            return (
              <div key={row.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(r.recordedAt), 'MMM d, yyyy · HH:mm')}
                  </span>
                  <BpStatusBadge systolic={r.systolic} diastolic={r.diastolic} />
                </div>
                {showUser && r.user && (
                  <p className="mt-0.5 truncate text-xs font-medium">
                    {r.user.name}
                  </p>
                )}
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-2xl font-bold tabular-nums">
                    {r.systolic}/{r.diastolic}
                  </span>
                  {r.pulse != null && (
                    <span className="text-sm text-muted-foreground">
                      {r.pulse} bpm
                    </span>
                  )}
                </div>
                {r.notes && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {r.notes}
                  </p>
                )}
                <div className="mt-1">
                  <RowActions
                    record={r}
                    onDelete={onDelete}
                    deletingId={deletingId}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border bg-card sm:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No readings found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
