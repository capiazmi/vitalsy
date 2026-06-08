import { useEffect, useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { BpStatusBadge } from '#/components/bp/bp-status-badge'
import { NOTE_TAGS, hasTag, toggleTag } from '#/lib/note-tags'
import { useDraft } from '#/hooks/use-draft'
import { cn } from '#/lib/utils'

export interface BpFormValues {
  systolic: string
  diastolic: string
  pulse: string
  notes: string
  recordedAt: string // datetime-local string
}

export interface BpSubmitPayload {
  systolic: number
  diastolic: number
  pulse?: number
  notes?: string
  recordedAt: Date
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

export function defaultBpValues(): BpFormValues {
  return {
    systolic: '',
    diastolic: '',
    pulse: '',
    notes: '',
    recordedAt: toLocalInput(new Date()),
  }
}

export function bpValuesFromRecord(r: {
  systolic: number
  diastolic: number
  pulse: number | null
  notes: string | null
  recordedAt: string
}): BpFormValues {
  return {
    systolic: String(r.systolic),
    diastolic: String(r.diastolic),
    pulse: r.pulse != null ? String(r.pulse) : '',
    notes: r.notes ?? '',
    recordedAt: toLocalInput(new Date(r.recordedAt)),
  }
}

function intError(
  value: string,
  { min, max, required }: { min: number; max: number; required?: boolean },
): string | undefined {
  if (value.trim() === '') return required ? 'Required' : undefined
  const n = Number(value)
  if (!Number.isInteger(n)) return 'Whole number only'
  if (n < min) return `Must be ≥ ${min}`
  if (n > max) return `Must be ≤ ${max}`
  return undefined
}

function FieldError({ errors }: { errors: Array<string | undefined> }) {
  const msg = errors.find(Boolean)
  if (!msg) return null
  return <p className="text-xs text-destructive">{msg}</p>
}

function isMeaningful(v: BpFormValues): boolean {
  return (
    v.systolic.trim() !== '' ||
    v.diastolic.trim() !== '' ||
    v.pulse.trim() !== '' ||
    v.notes.trim() !== ''
  )
}

export function BpForm({
  initialValues,
  onSubmit,
  submitting,
  submitLabel = 'Save reading',
  draftKey,
}: {
  initialValues?: BpFormValues
  onSubmit: (payload: BpSubmitPayload) => unknown | Promise<unknown>
  submitting?: boolean
  submitLabel?: string
  /** When set, the form auto-saves its values to localStorage and restores them. */
  draftKey?: string
}) {
  const draft = useDraft<BpFormValues>(draftKey ?? '')
  const [restored, setRestored] = useState(false)

  const form = useForm({
    defaultValues: initialValues ?? defaultBpValues(),
    onSubmit: async ({ value }) => {
      await onSubmit({
        systolic: Number(value.systolic),
        diastolic: Number(value.diastolic),
        pulse: value.pulse.trim() === '' ? undefined : Number(value.pulse),
        notes: value.notes.trim() === '' ? undefined : value.notes.trim(),
        recordedAt: new Date(value.recordedAt),
      })
      if (draftKey) draft.clear()
    },
  })

  // Restore a saved draft after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    if (!draftKey) return
    const saved = draft.read()
    if (saved && isMeaningful(saved)) {
      form.reset(saved)
      setRestored(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  // Debounced auto-save of meaningful values.
  const values = useStore(form.store, (s) => s.values)
  useEffect(() => {
    if (!draftKey) return
    const id = setTimeout(() => {
      if (isMeaningful(values)) draft.save(values)
    }, 400)
    return () => clearTimeout(id)
  }, [values, draftKey, draft])

  function discardDraft() {
    if (draftKey) draft.clear()
    form.reset(initialValues ?? defaultBpValues())
    setRestored(false)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      className="space-y-5"
    >
      {restored && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200">
          <span>Draft restored from your last unsaved entry.</span>
          <button
            type="button"
            onClick={discardDraft}
            className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Discard
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="systolic"
          validators={{
            onChange: ({ value }) =>
              intError(value, { min: 40, max: 300, required: true }),
          }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Systolic (mmHg)</Label>
              <Input
                id={field.name}
                inputMode="numeric"
                placeholder="120"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field
          name="diastolic"
          validators={{
            onChange: ({ value }) =>
              intError(value, { min: 20, max: 200, required: true }),
          }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Diastolic (mmHg)</Label>
              <Input
                id={field.name}
                inputMode="numeric"
                placeholder="80"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="pulse"
          validators={{
            onChange: ({ value }) => intError(value, { min: 20, max: 250 }),
          }}
        >
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Pulse (bpm)</Label>
              <Input
                id={field.name}
                inputMode="numeric"
                placeholder="Optional"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field name="recordedAt">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Recorded at</Label>
              <Input
                id={field.name}
                type="datetime-local"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="notes">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Notes</Label>

            {/* Quick-select tags — tap to add/remove */}
            <div className="flex flex-wrap gap-1.5">
              {NOTE_TAGS.flatMap((g) => g.tags).map((tag) => {
                const active = hasTag(field.state.value, tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      field.handleChange(toggleTag(field.state.value, tag))
                    }
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      active
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>

            <Textarea
              id={field.name}
              rows={2}
              placeholder="Tap tags above or type your own…"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      {/* Live status preview */}
      <form.Subscribe selector={(s) => [s.values.systolic, s.values.diastolic]}>
        {([sys, dia]) => {
          const s = Number(sys)
          const d = Number(dia)
          if (!s || !d) return null
          return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Category: <BpStatusBadge systolic={s} diastolic={d} />
            </div>
          )
        }}
      </form.Subscribe>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={!canSubmit || isSubmitting || submitting}
          >
            {(isSubmitting || submitting) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {submitLabel}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
