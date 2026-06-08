import { createFileRoute, useParams, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { userQueryOptions } from '#/lib/queries'
import { updateUser } from '#/server/users'
import type { Role } from '#/lib/roles'
import { PageHeader } from '#/components/page-header'
import { UserForm, type UserSubmitPayload } from '#/components/users/user-form'
import { Card, CardContent } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

export const Route = createFileRoute('/_authed/admin/users/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(userQueryOptions(params.id)),
  component: EditUserPage,
})

function EditUserPage() {
  const { id } = useParams({ from: '/_authed/admin/users/$id' })
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useQuery(userQueryOptions(id))

  const update = useMutation({
    mutationFn: (payload: UserSubmitPayload) =>
      updateUser({
        data: {
          id,
          name: payload.name,
          role: payload.role,
          isActive: payload.isActive,
          password: payload.password || undefined,
        },
      }),
    onSuccess: () => {
      toast.success('User updated')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      router.navigate({ to: '/admin/users' })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  if (isLoading || !user) {
    return <Skeleton className="h-96 max-w-xl" />
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title={`Edit ${user.name}`} description={user.email} />
      <Card>
        <CardContent className="pt-6">
          <UserForm
            mode="edit"
            initialValues={{
              name: user.name,
              email: user.email,
              role: user.role as Role,
              isActive: user.isActive,
            }}
            submitting={update.isPending}
            onSubmit={(p) => update.mutate(p)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
