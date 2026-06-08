import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { fetchSmtpSettings, saveSmtpSettings, testSmtp } from '#/server/settings'
import { PageHeader } from '#/components/page-header'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export const Route = createFileRoute('/_authed/admin/email')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ['smtp-settings'],
      queryFn: () => fetchSmtpSettings(),
    }),
  component: EmailSettingsPage,
})

function EmailSettingsPage() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: () => fetchSmtpSettings(),
  })

  const [enabled, setEnabled] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [secure, setSecure] = useState(false)
  const [smtpUser, setSmtpUser] = useState('')
  const [pass, setPass] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  )

  useEffect(() => {
    if (!data) return
    setEnabled(data.notificationsEnabled)
    setHost(data.host)
    setPort(data.port != null ? String(data.port) : '587')
    setSecure(data.secure)
    setSmtpUser(data.user)
    setFromName(data.fromName)
    setFromEmail(data.fromEmail)
    setTestTo((t) => t || user.email)
  }, [data, user.email])

  const save = useMutation({
    mutationFn: () =>
      saveSmtpSettings({
        data: {
          notificationsEnabled: enabled,
          host,
          port: port ? Number(port) : null,
          secure,
          user: smtpUser,
          pass, // '' = keep, '__clear__' = clear
          fromName,
          fromEmail,
        },
      }),
    onSuccess: () => {
      toast.success('Email settings saved')
      setPass('')
      queryClient.invalidateQueries({ queryKey: ['smtp-settings'] })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const test = useMutation({
    mutationFn: () => testSmtp({ data: { to: testTo } }),
    onSuccess: (res) => setTestResult(res),
    onError: (e) => setTestResult({ ok: false, message: (e as Error).message }),
  })

  if (!data) return <Skeleton className="h-96 max-w-2xl" />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Email & notifications"
        description="SMTP server and outgoing email notifications."
        action={
          <Badge variant={data.configured ? 'default' : 'secondary'}>
            {data.configured ? 'SMTP configured' : 'Not configured'}
          </Badge>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>
            Master switch for all outgoing emails (account created, password
            resets, self-service reset). When off, nothing is sent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className="text-sm">
              {enabled ? 'Notifications enabled' : 'Notifications disabled'}
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">SMTP server</CardTitle>
          <CardDescription>
            Used to send all notification emails. DB values override environment
            variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                inputMode="numeric"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="587"
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <Switch checked={secure} onCheckedChange={setSecure} />
            <span className="text-sm">
              Use TLS/SSL (on for port 465; off for 587/STARTTLS)
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user">Username</Label>
              <Input
                id="user"
                autoComplete="off"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="apikey / user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="pass"
                  type="password"
                  autoComplete="new-password"
                  value={pass === '__clear__' ? '' : pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder={
                    data.passSet || data.envPassSet ? '••••••••' : 'Enter password'
                  }
                />
                {data.passSet && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPass('__clear__')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {pass === '__clear__'
                  ? 'Saved password will be removed.'
                  : data.passSet
                    ? 'Saved — leave blank to keep.'
                    : data.envPassSet
                      ? 'Using env var — type to override.'
                      : 'Not set.'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fromName">From name</Label>
              <Input
                id="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="BP Monitor"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fromEmail">From email</Label>
              <Input
                id="fromEmail"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="no-reply@example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Send a test</CardTitle>
          <CardDescription>
            Sends a test email using the <strong>saved</strong> SMTP settings
            (ignores the master toggle). Save first to test edits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
            />
            <Button
              variant="outline"
              onClick={() => test.mutate()}
              disabled={test.isPending || !testTo}
            >
              {test.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send test
            </Button>
          </div>
          {testResult && (
            <div
              className={`flex items-start gap-1.5 text-xs ${testResult.ok ? 'text-emerald-600' : 'text-destructive'}`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span className="break-all">{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </div>
    </div>
  )
}
