import type { DrugSearchResult } from '@pharmassist/shared'

/** Seeds the details form (Popup 2) from a confirmed search result. */
export function searchResultToInitialRx(result: DrugSearchResult): { drugId: string; dose: string } {
  return { drugId: result.id, dose: result.strength }
}
