import { useRef, useState } from 'react'
import { createFileRoute, useRouter, useSearch } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Cropper, { type Area } from 'react-easy-crop'
import { Crop as CropIcon, ImageUp, Loader2, ScanLine, X } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { createRecordFromScan } from '#/server/records'
import { processOcr } from '#/server/ocr'
import { blobToDataUrl, dataUrlToBlob, getCroppedBlob } from '#/lib/crop-image'
import type { OcrResult } from '#/lib/validation'
import { PageHeader } from '#/components/page-header'
import {
  BpForm,
  defaultBpValues,
  type BpFormValues,
  type BpSubmitPayload,
} from '#/components/bp/bp-form'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

const searchSchema = z.object({
  scan: z.boolean().optional(),
  // OCR/manual deep-link prefill
  systolic: z.coerce.number().optional(),
  diastolic: z.coerce.number().optional(),
  pulse: z.coerce.number().optional(),
})

export const Route = createFileRoute('/_authed/records/new')({
  validateSearch: searchSchema,
  component: NewRecordPage,
})

function NewRecordPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const search = useSearch({ from: '/_authed/records/new' })
  const fileRef = useRef<HTMLInputElement>(null)

  // Scanner state
  const [showScanner, setShowScanner] = useState(Boolean(search.scan))
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  // Bumping this remounts the form with fresh values after a scan.
  const [formSeed, setFormSeed] = useState(0)

  const formInitial: BpFormValues = ocrResult
    ? {
        ...defaultBpValues(),
        systolic: ocrResult.systolic != null ? String(ocrResult.systolic) : '',
        diastolic: ocrResult.diastolic != null ? String(ocrResult.diastolic) : '',
        pulse: ocrResult.pulse != null ? String(ocrResult.pulse) : '',
      }
    : {
        ...defaultBpValues(),
        systolic: search.systolic ? String(search.systolic) : '',
        diastolic: search.diastolic ? String(search.diastolic) : '',
        pulse: search.pulse ? String(search.pulse) : '',
      }

  const scan = useMutation({
    mutationFn: async () => {
      if (!imageSrc || !areaPixels) throw new Error('Crop the display first')
      const blob = await getCroppedBlob(imageSrc, areaPixels)
      const croppedUrl = await blobToDataUrl(blob)
      const fd = new FormData()
      fd.append('image', blob, 'bp.png')
      const res = await processOcr({ data: fd })
      return { res, croppedUrl }
    },
    onSuccess: ({ res, croppedUrl }) => {
      setCroppedDataUrl(croppedUrl)
      setOcrResult(res)
      setImageSrc(null)
      // Clear any stale form draft so the scanned values aren't overwritten.
      try {
        window.localStorage.removeItem('draft:new-record')
      } catch {
        /* ignore */
      }
      setFormSeed((s) => s + 1)
      if (res.warning) toast.warning(res.warning, { duration: 8000 })
      else if (res.systolic == null && res.diastolic == null)
        toast.warning('Could not read values — please enter them manually.')
      else toast.success('Values filled in — verify, then save.')
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const save = useMutation({
    mutationFn: async (payload: BpSubmitPayload) => {
      const fd = new FormData()
      fd.append('systolic', String(payload.systolic))
      fd.append('diastolic', String(payload.diastolic))
      if (payload.pulse != null) fd.append('pulse', String(payload.pulse))
      if (payload.notes) fd.append('notes', payload.notes)
      fd.append('recordedAt', payload.recordedAt.toISOString())
      if (croppedDataUrl) {
        fd.append('image', await dataUrlToBlob(croppedDataUrl), 'bp.png')
      }
      return createRecordFromScan({ data: fd })
    },
    onSuccess: () => {
      toast.success('Reading saved')
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      router.navigate({ to: '/records' })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  function onPick(file: File) {
    setOcrResult(null)
    setCroppedDataUrl(null)
    setZoom(1)
    setCrop({ x: 0, y: 0 })
    setImageSrc(URL.createObjectURL(file))
  }

  function clearScan() {
    setImageSrc(null)
    setCroppedDataUrl(null)
    setOcrResult(null)
    setAreaPixels(null)
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Add reading"
        description="Enter values manually, or scan a photo of your monitor."
      />

      {/* Optional scan */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanLine className="h-4 w-4" /> Scan from photo
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </CardTitle>
              <CardDescription>
                We’ll read the numbers and fill the form for you.
              </CardDescription>
            </div>
            {(showScanner || croppedDataUrl) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Close scanner"
                onClick={() => {
                  clearScan()
                  setShowScanner(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPick(f)
            }}
          />

          {!showScanner && !croppedDataUrl ? (
            <Button variant="outline" onClick={() => setShowScanner(true)}>
              <ScanLine className="mr-2 h-4 w-4" /> Scan a photo
            </Button>
          ) : imageSrc ? (
            <>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CropIcon className="h-4 w-4" /> Crop tightly to the SYS/DIA/PULSE
                digits.
              </p>
              <div className="relative h-64 w-full overflow-hidden rounded-lg bg-black">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  minZoom={0.5}
                  restrictPosition={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, areaPx) => setAreaPixels(areaPx)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => scan.mutate()}
                  disabled={scan.isPending}
                >
                  {scan.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ScanLine className="mr-2 h-4 w-4" />
                  )}
                  {scan.isPending ? 'Reading…' : 'Read values'}
                </Button>
                <Button variant="outline" onClick={() => setImageSrc(null)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : croppedDataUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={croppedDataUrl}
                alt="Scanned reading"
                className="max-h-20 rounded border bg-white object-contain"
              />
              <div className="text-sm text-muted-foreground">
                <p>Filled the form below — please verify.</p>
                {ocrResult?.provider && (
                  <p className="text-xs">Read with {ocrResult.provider}.</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => fileRef.current?.click()}
              >
                <ImageUp className="mr-1.5 h-4 w-4" /> Re-scan
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-muted-foreground transition-colors hover:border-teal-500 hover:text-teal-600"
            >
              <ImageUp className="h-7 w-7" />
              <span className="text-sm font-medium">Choose or take a photo</span>
            </button>
          )}

          {ocrResult?.rawText && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">
                What the reader saw
              </summary>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">
                {ocrResult.rawText}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>

      {/* The reading form (manual or prefilled by the scan) */}
      <Card>
        <CardContent className="pt-6">
          <BpForm
            key={formSeed}
            draftKey={ocrResult ? undefined : 'draft:new-record'}
            initialValues={formInitial}
            submitting={save.isPending}
            onSubmit={(p) => save.mutateAsync(p)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
