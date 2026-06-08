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
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link to="/records/$id" params={{ id: c.row.original.id }}>
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
                  disabled={deletingId === c.row.original.id}
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
                    onClick={() => onDelete(c.row.original.id)}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
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

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
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
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No readings found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
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
  )
}
