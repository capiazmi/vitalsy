import { createFileRoute, useParams, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { recordQueryOptions } from '#/lib/queries'
import { deleteRecord, getRecordImage, updateRecord } from '#/server/records'
import { PageHeader } from '#/components/page-header'
import {
  BpForm,
  bpValuesFromRecord,
  type BpSubmitPayload,
} from '#/components/bp/bp-form'
import { BpStatusBadge } from '#/components/bp/bp-status-badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
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

export const Route = createFileRoute('/_authed/records/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(recordQueryOptions(params.id)),
  component: RecordDetailPage,
})

function RecordDetailPage() {
  const { id } = useParams({ from: '/_authed/records/$id' })
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: record, isLoading } = useQuery(recordQueryOptions(id))
  const { data: image } = useQuery({
    queryKey: ['record-image', id],
    queryFn: () => getRecordImage({ data: { id } }),
    enabled: Boolean(record?.imagePath),
    staleTime: 5 * 60 * 1000,
  })

  const update = useMutation({
    mutationFn: (payload: BpSubmitPayload) =>
      updateRecord({
        data: {
          id,
          systolic: payload.systolic,
          diastolic: payload.diastolic,
          pulse: payload.pulse,
          notes: payload.notes,
          recordedAt: payload.recordedAt,
        },
      }),
    onSuccess: () => {
      toast.success('Reading updated')
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['record', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const del = useMutation({
    mutationFn: () => deleteRecord({ data: { id } }),
    onSuccess: () => {
      toast.success('Reading deleted')
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      router.navigate({ to: '/records' })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  if (isLoading || !record) {
    return <Skeleton className="h-96 max-w-xl" />
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Reading"
        description={format(new Date(record.recordedAt), 'PPPp')}
        action={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
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
                  onClick={() => del.mutate()}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-3">
            {record.systolic}/{record.diastolic}
            <BpStatusBadge
              systolic={record.systolic}
              diastolic={record.diastolic}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {record.pulse != null && <p>Pulse: {record.pulse} bpm</p>}
          {record.user && <p>User: {record.user.name}</p>}
          {record.imagePath && (
            <div className="pt-1">
              <p className="mb-1">Source image</p>
              {image?.dataUrl ? (
                <img
                  src={image.dataUrl}
                  alt="Source reading"
                  className="max-h-56 rounded border bg-white object-contain"
                />
              ) : (
                <Skeleton className="h-40 w-56" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit</CardTitle>
        </CardHeader>
        <CardContent>
          <BpForm
            initialValues={bpValuesFromRecord(record)}
            submitting={update.isPending}
            submitLabel="Update reading"
            onSubmit={(p) => update.mutate(p)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
