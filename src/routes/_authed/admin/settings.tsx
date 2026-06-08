import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle } from 'lucide-react'
import {
  fetchOcrSettings,
  listOcrModels,
  saveOcrSettings,
  testOcrProvider,
  type OcrSettingsView,
} from '#/server/settings'
import { PageHeader } from '#/components/page-header'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export const Route = createFileRoute('/_authed/admin/settings')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ['ocr-settings'],
      queryFn: () => fetchOcrSettings(),
    }),
  component: SettingsPage,
})

type ProviderChoice = OcrSettingsView['provider']

function SettingsPage() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['ocr-settings'],
    queryFn: () => fetchOcrSettings(),
  })

  const [provider, setProvider] = useState<ProviderChoice>('auto')
  const [anthropicModel, setAnthropicModel] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [ollamaHost, setOllamaHost] = useState('')
  const [ollamaKey, setOllamaKey] = useState('')
  const [ollamaModel, setOllamaModel] = useState('')
  const [models, setModels] = useState<{ anthropic: Array<string>; ollama: Array<string> }>({
    anthropic: [],
    ollama: [],
  })

  // Seed local state once settings load.
  useEffect(() => {
    if (!data) return
    setProvider(data.provider)
    setAnthropicModel(data.anthropicModel)
    setOllamaHost(data.ollamaHost)
    setOllamaModel(data.ollamaModel)
  }, [data])

  const loadModels = useMutation({
    mutationFn: (p: 'anthropic' | 'ollama') => listOcrModels({ data: { provider: p } }),
    onSuccess: (res, p) => {
      setModels((m) => ({ ...m, [p]: res.models }))
      if (res.models.length === 0) {
        toast.info('No models returned — enter the model name manually.')
      }
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const [testResult, setTestResult] = useState<
    Record<string, { ok: boolean; message: string }>
  >({})
  const test = useMutation({
    mutationFn: (p: 'anthropic' | 'ollama') => testOcrProvider({ data: { provider: p } }),
    onSuccess: (res, p) => setTestResult((t) => ({ ...t, [p]: res })),
    onError: (e, p) =>
      setTestResult((t) => ({ ...t, [p]: { ok: false, message: (e as Error).message } })),
  })

  const save = useMutation({
    mutationFn: () =>
      saveOcrSettings({
        data: {
          provider,
          anthropicModel,
          anthropicApiKey: anthropicKey, // '' = keep current
          ollamaHost,
          ollamaApiKey: ollamaKey,
          ollamaModel,
        },
      }),
    onSuccess: () => {
      toast.success('Settings saved')
      setAnthropicKey('')
      setOllamaKey('')
      queryClient.invalidateQueries({ queryKey: ['ocr-settings'] })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  if (!data) return <Skeleton className="h-96 max-w-2xl" />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="Configure how blood-pressure photos are read (OCR)."
        action={
          <Badge variant="secondary">Active: {data.activeProvider}</Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">OCR provider</CardTitle>
          <CardDescription>
            “Auto” picks Claude, then Ollama, then the offline reader based on
            what’s configured. DB settings here override environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-1.5">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as ProviderChoice)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
                <SelectItem value="tesseract">Offline (Tesseract)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Claude */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claude (Anthropic)</CardTitle>
          <CardDescription>
            Most accurate. Image is sent to Anthropic; billed per scan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SecretField
            label="API key"
            value={anthropicKey}
            onChange={setAnthropicKey}
            isSet={data.anthropicApiKeySet}
            envSet={data.anthropicEnvKeySet}
          />
          <ModelField
            label="Model"
            value={anthropicModel}
            onChange={setAnthropicModel}
            options={models.anthropic}
            loading={loadModels.isPending && loadModels.variables === 'anthropic'}
            onLoad={() => loadModels.mutate('anthropic')}
            placeholder="claude-opus-4-8"
          />
          <TestRow
            loading={test.isPending && test.variables === 'anthropic'}
            onTest={() => test.mutate('anthropic')}
            result={testResult.anthropic}
          />
        </CardContent>
      </Card>

      {/* Ollama */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ollama</CardTitle>
          <CardDescription>
            Ollama Cloud (https://ollama.com + key) or local
            (http://localhost:11434). Local keeps images on-prem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ollamaHost">Host</Label>
            <Input
              id="ollamaHost"
              value={ollamaHost}
              onChange={(e) => setOllamaHost(e.target.value)}
              placeholder="https://ollama.com"
            />
          </div>
          <SecretField
            label="API key (Cloud)"
            value={ollamaKey}
            onChange={setOllamaKey}
            isSet={data.ollamaApiKeySet}
            envSet={data.ollamaEnvKeySet}
          />
          <ModelField
            label="Model"
            value={ollamaModel}
            onChange={setOllamaModel}
            options={models.ollama}
            loading={loadModels.isPending && loadModels.variables === 'ollama'}
            onLoad={() => loadModels.mutate('ollama')}
            placeholder="qwen2.5vl"
          />
          <TestRow
            loading={test.isPending && test.variables === 'ollama'}
            onTest={() => test.mutate('ollama')}
            result={testResult.ollama}
          />
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

function TestRow({
  loading,
  onTest,
  result,
}: {
  loading: boolean
  onTest: () => void
  result?: { ok: boolean; message: string }
}) {
  return (
    <div className="space-y-2 border-t pt-3">
      <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Test connection
      </Button>
      <p className="text-xs text-muted-foreground">
        Tests the <strong>saved</strong> key &amp; model (save first to test edits).
      </p>
      {result && (
        <div
          className={`flex items-start gap-1.5 text-xs ${result.ok ? 'text-emerald-600' : 'text-destructive'}`}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span className="break-all">{result.message}</span>
        </div>
      )}
    </div>
  )
}

function SecretField({
  label,
  value,
  onChange,
  isSet,
  envSet,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  isSet: boolean
  envSet: boolean
}) {
  const hint = isSet
    ? 'A key is saved. Leave blank to keep it, or type a new one.'
    : envSet
      ? 'Using the environment variable. Type a key here to override it.'
      : 'Not set.'
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isSet || envSet ? '••••••••' : 'Enter key'}
        />
        {isSet && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange('__clear__')}
            title="Clear saved key"
          >
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === '__clear__' ? 'Saved key will be removed on save.' : hint}
      </p>
    </div>
  )
}

function ModelField({
  label,
  value,
  onChange,
  options,
  loading,
  onLoad,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<string>
  loading: boolean
  onLoad: () => void
  placeholder: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={onLoad} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1.5 hidden sm:inline">Load list</span>
        </Button>
      </div>
      {options.length > 0 && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Pick from available models" />
          </SelectTrigger>
          <SelectContent>
            {options.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
