import { bpStatus } from '#/lib/bp-utils'
import { cn } from '#/lib/utils'

export function BpStatusBadge({
  systolic,
  diastolic,
  className,
}: {
  systolic: number
  diastolic: number
  className?: string
}) {
  const status = bpStatus(systolic, diastolic)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        status.className,
        className,
      )}
    >
      {status.label}
    </span>
  )
}
