import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { ROLES, type Role } from '#/lib/roles'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export interface UserFormValues {
  name: string
  email: string
  password: string
  role: Role
  isActive: boolean
}

export interface UserSubmitPayload {
  name: string
  email: string
  password: string
  role: Role
  isActive: boolean
}

function FieldError({ errors }: { errors: Array<string | undefined> }) {
  const msg = errors.find(Boolean)
  return msg ? <p className="text-xs text-destructive">{msg}</p> : null
}

export function UserForm({
  mode,
  initialValues,
  onSubmit,
  submitting,
}: {
  mode: 'create' | 'edit'
  initialValues?: Partial<UserFormValues>
  onSubmit: (payload: UserSubmitPayload) => void | Promise<void>
  submitting?: boolean
}) {
  const form = useForm({
    defaultValues: {
      name: initialValues?.name ?? '',
      email: initialValues?.email ?? '',
      password: '',
      role: initialValues?.role ?? ROLES.USER,
      isActive: initialValues?.isActive ?? true,
    } as UserFormValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-5"
    >
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) => (value.trim() ? undefined : 'Required'),
        }}
      >
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) =>
            mode === 'create' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
              ? 'Valid email required'
              : undefined,
        }}
      >
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              disabled={mode === 'edit'}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {mode === 'edit' && (
              <p className="text-xs text-muted-foreground">
                Email cannot be changed.
              </p>
            )}
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <form.Field
        name="password"
        validators={{
          onChange: ({ value }) => {
            if (mode === 'create' && value.length < 8)
              return 'At least 8 characters'
            if (mode === 'edit' && value.length > 0 && value.length < 8)
              return 'At least 8 characters'
            return undefined
          },
        }}
      >
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor="password">
              {mode === 'create' ? 'Password' : 'New password (optional)'}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={mode === 'edit' ? 'Leave blank to keep current' : ''}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-4">
        <form.Field name="role">
          {(field) => (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as Role)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROLES.USER}>User</SelectItem>
                  <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="isActive">
          {(field) => (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  checked={field.state.value}
                  onCheckedChange={(c) => field.handleChange(c)}
                />
                <span className="text-sm text-muted-foreground">
                  {field.state.value ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          )}
        </form.Field>
      </div>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit || isSubmitting || submitting}>
            {(isSubmitting || submitting) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {mode === 'create' ? 'Create user' : 'Save changes'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
