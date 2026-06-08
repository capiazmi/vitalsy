import type { ReactNode } from 'react'
import { Card, CardContent } from '#/components/ui/card'
import { cn } from '#/lib/utils'

export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums')}>{value}</p>
          {hint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {icon ? <div className="text-teal-600">{icon}</div> : null}
      </CardContent>
    </Card>
  )
}
