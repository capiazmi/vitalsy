// Blood-pressure categorisation based on the ACC/AHA 2017 guideline.
// This is informational only — not medical advice.

export type BpCategory =
  | 'low'
  | 'normal'
  | 'elevated'
  | 'stage1'
  | 'stage2'
  | 'crisis'

export interface BpStatus {
  category: BpCategory
  label: string
  /** Tailwind text/badge color classes. */
  className: string
  /** chart color token */
  color: string
}

const STATUS: Record<BpCategory, Omit<BpStatus, 'category'>> = {
  low: {
    label: 'Low',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    color: '#0ea5e9',
  },
  normal: {
    label: 'Normal',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    color: '#10b981',
  },
  elevated: {
    label: 'Elevated',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    color: '#f59e0b',
  },
  stage1: {
    label: 'Hypertension St. 1',
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    color: '#f97316',
  },
  stage2: {
    label: 'Hypertension St. 2',
    className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    color: '#ef4444',
  },
  crisis: {
    label: 'Crisis — seek care',
    className: 'bg-red-600 text-white',
    color: '#b91c1c',
  },
}

export function categorize(systolic: number, diastolic: number): BpCategory {
  if (systolic > 180 || diastolic > 120) return 'crisis'
  if (systolic >= 140 || diastolic >= 90) return 'stage2'
  if (systolic >= 130 || diastolic >= 80) return 'stage1'
  if (systolic >= 120) return 'elevated'
  if (systolic < 90 || diastolic < 60) return 'low'
  return 'normal'
}

export function bpStatus(systolic: number, diastolic: number): BpStatus {
  const category = categorize(systolic, diastolic)
  return { category, ...STATUS[category] }
}

export function formatBp(systolic: number, diastolic: number): string {
  return `${systolic}/${diastolic}`
}
