import type { RecordsQuery } from '#/lib/validation'
import { Label } from '#/components/ui/label'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

const PRESETS: Array<{ value: RecordsQuery['range']; label: string }> = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
]

export function RangeFilter({
  value,
  onChange,
}: {
  value: RecordsQuery
  onChange: (next: RecordsQuery) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Range</Label>
        <Select
          value={value.range}
          onValueChange={(range) =>
            onChange({ ...value, range: range as RecordsQuery['range'] })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.range === 'custom' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              className="w-[150px]"
              value={value.from ? value.from.slice(0, 10) : ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  from: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : undefined,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              className="w-[150px]"
              value={value.to ? value.to.slice(0, 10) : ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  to: e.target.value
                    ? new Date(e.target.value + 'T23:59:59').toISOString()
                    : undefined,
                })
              }
            />
          </div>
        </>
      )}
    </div>
  )
}
