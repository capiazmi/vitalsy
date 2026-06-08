import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createUser } from '#/server/users'
import { PageHeader } from '#/components/page-header'
import { UserForm, type UserSubmitPayload } from '#/components/users/user-form'
import { Card, CardContent } from '#/components/ui/card'

export const Route = createFileRoute('/_authed/admin/users/new')({
  component: NewUserPage,
})

function NewUserPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: (payload: UserSubmitPayload) =>
      createUser({
        data: {
          name: payload.name,
          email: payload.email,
          password: payload.password,
          role: payload.role,
        },
      }),
    onSuccess: () => {
      toast.success('User created')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      router.navigate({ to: '/admin/users' })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="New user" description="Create an account." />
      <Card>
        <CardContent className="pt-6">
          <UserForm
            mode="create"
            submitting={create.isPending}
            onSubmit={(p) => create.mutate(p)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
