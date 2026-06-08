import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { usersQueryOptions } from '#/lib/queries'
import { deleteUser, setUserActive, type SerializedUser } from '#/server/users'
import { roleLabel } from '#/lib/roles'
import { PageHeader } from '#/components/page-header'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Switch } from '#/components/ui/switch'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
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

export const Route = createFileRoute('/_authed/admin/users/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(usersQueryOptions()),
  component: UsersPage,
})

function UsersPage() {
  const { user: currentUser } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const { data: users, isLoading } = useQuery(usersQueryOptions())

  const toggle = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) =>
      setUserActive({ data: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => toast.error((e as Error).message),
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteUser({ data: { id } }),
    onSuccess: () => {
      toast.success('User deleted')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage accounts and access."
        action={
          <Button asChild size="sm">
            <Link to="/admin/users/new">
              <UserPlus className="mr-1.5 h-4 w-4" /> New user
            </Link>
          </Button>
        }
      />

      {isLoading || !users ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 sm:hidden">
            {users.map((u) => (
              <div key={u.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email}
                    </p>
                  </div>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                    {roleLabel(u.role)}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {u.recordCount} readings · joined{' '}
                  {format(new Date(u.createdAt), 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last login:{' '}
                  {u.lastLoginAt ? (
                    format(new Date(u.lastLoginAt), 'MMM d, yyyy · HH:mm')
                  ) : (
                    <span className="text-amber-600">Never</span>
                  )}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={u.isActive}
                      disabled={u.id === currentUser.id || toggle.isPending}
                      onCheckedChange={(c) =>
                        toggle.mutate({ id: u.id, isActive: c })
                      }
                    />
                    {u.isActive ? 'Active' : 'Disabled'}
                  </label>
                  {renderActions(u)}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-lg border bg-card sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Readings</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === 'admin' ? 'default' : 'secondary'}
                      >
                        {roleLabel(u.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {u.recordCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(u.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {u.lastLoginAt ? (
                        format(new Date(u.lastLoginAt), 'MMM d · HH:mm')
                      ) : (
                        <span className="text-amber-600">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.isActive}
                        disabled={u.id === currentUser.id || toggle.isPending}
                        onCheckedChange={(c) =>
                          toggle.mutate({ id: u.id, isActive: c })
                        }
                      />
                    </TableCell>
                    <TableCell>{renderActions(u)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )

  function renderActions(u: SerializedUser) {
    return (
      <div className="flex justify-end gap-1">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link to="/admin/users/$id" params={{ id: u.id }}>
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
        {u.id !== currentUser.id && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {u.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the user and all of their readings.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => del.mutate(u.id)}
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
}
