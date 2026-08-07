export interface MedicineSeedRow {
  label: string
  name: string
  strength: string
  form: string
  category: string
  unitPrice: string
}

function deriveForm(str: string): string {
  const s = str.toLowerCase()
  if (/\binj|injection|injectable\b/.test(s)) return 'Injection'
  if (/\bsyrup|suspension|solution|drops\b/.test(s)) return 'Syrup'
  if (/\bcap|capsule\b/.test(s)) return 'Capsule'
  if (/\bcream|ointment|gel|patch\b/.test(s)) return 'Topical'
  return 'Tablet'
}

function deriveStrength(str: string): string {
  const m = str.match(/\b\d+(?:\.\d+)?\s?(?:mg|ml|mcg|iu|g)\b/i)
  return m ? m[0].trim().replace(/\s+/g, ' ').toUpperCase().replace('MG', 'MG') : ''
}

export function parseMedicineLine(rawLine: string): MedicineSeedRow | null {
  const str = rawLine.trim()
  if (!str || str.toLowerCase() === 'str') return null

  const name = str.replace(/\[.*?\]/g, '').trim() || str

  return {
    label: str,
    name,
    strength: deriveStrength(str),
    form: deriveForm(str),
    category: 'Uncategorized',
    unitPrice: '0',
  }
}
