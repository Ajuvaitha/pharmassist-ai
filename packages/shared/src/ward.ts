const WARD_SEPARATOR = ' — '

/** Composes the display string the UI shows, e.g. "Ward 4A — General Medicine". */
export function wardLabel(ward: { code: string; name: string }): string {
  return `${ward.code}${WARD_SEPARATOR}${ward.name}`
}

/**
 * Recovers the ward code from a composed label. Splits on the first
 * separator only, so a ward name containing an em-dash survives intact.
 */
export function parseWardCode(label: string): string {
  const index = label.indexOf(WARD_SEPARATOR)
  return index === -1 ? label : label.slice(0, index)
}
