import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import type { SerializedRecord } from '#/server/records'

export function BpChart({
  records,
  showPulse = false,
}: {
  records: Array<SerializedRecord>
  showPulse?: boolean
}) {
  // Recharts expects chronological order (oldest → newest).
  const data = useMemo(
    () =>
      [...records]
        .sort(
          (a, b) =>
            new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
        )
        .map((r) => ({
          t: new Date(r.recordedAt).getTime(),
          systolic: r.systolic,
          diastolic: r.diastolic,
          pulse: r.pulse,
        })),
    [records],
  )

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No readings in this range yet.
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t) => format(new Date(t), 'MMM d')}
            tick={{ fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis tick={{ fontSize: 11 }} domain={['dataMin - 10', 'dataMax + 10']} />
          <Tooltip
            labelFormatter={(t) => format(new Date(t as number), 'PPpp')}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          {/* Reference lines for hypertension thresholds */}
          <ReferenceLine y={130} stroke="#f97316" strokeDasharray="4 4" />
          <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="systolic"
            name="Systolic"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="diastolic"
            name="Diastolic"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
          {showPulse && (
            <Line
              type="monotone"
              dataKey="pulse"
              name="Pulse"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
