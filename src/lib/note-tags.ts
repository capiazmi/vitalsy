// Quick-select annotations for the notes field. Edit/extend freely — these are
// just suggestions the user can tap to add (they can still type free text too).
export const NOTE_TAGS: Array<{ group: string; tags: Array<string> }> = [
  { group: 'Arm', tags: ['Left arm', 'Right arm'] },
  { group: 'Posture', tags: ['Sitting', 'Lying down', 'Standing'] },
  {
    group: 'Context',
    tags: [
      'Before meal',
      'After meal',
      'After exercise',
      'Resting',
      'Morning',
      'Evening',
      'After medication',
      'Stressed',
    ],
  },
  {
    group: 'Symptoms',
    tags: ['Gastric', 'Headache', 'Dizziness', 'Chest pain', 'Palpitations'],
  },
]

const SEP = ', '

function tokens(notes: string): Array<string> {
  return notes
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function hasTag(notes: string, tag: string): boolean {
  const t = tag.toLowerCase()
  return tokens(notes).some((x) => x.toLowerCase() === t)
}

/** Adds the tag if absent, removes it if present. Preserves free-text tokens. */
export function toggleTag(notes: string, tag: string): string {
  const list = tokens(notes)
  const i = list.findIndex((x) => x.toLowerCase() === tag.toLowerCase())
  if (i >= 0) list.splice(i, 1)
  else list.push(tag)
  return list.join(SEP)
}
