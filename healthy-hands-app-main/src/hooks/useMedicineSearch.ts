import { useMemo } from "react";
import Fuse from "fuse.js";
import { MEDICINES, type Medicine, type MedicineMatch } from "@/data/medicines";

/**
 * Single shared medicine search used by BOTH the "Type" search bar and the
 * "Write" handwriting pad, so both input modes behave identically.
 *
 * - Exact / substring-anywhere matches are ranked first (case-insensitive,
 *   across genericName AND every brand name).
 * - Fuse.js supplies typo tolerance ("amoxicilin", "paracetmol") for anything
 *   the literal pass missed.
 * - Medicines from the top match's category are returned separately as
 *   "Related / Alternatives".
 */

const fuse = new Fuse(MEDICINES, {
  includeScore: true,
  threshold: 0.38,
  ignoreLocation: true,
  minMatchCharLength: 1,
  keys: [
    { name: "genericName", weight: 2 },
    { name: "brandNames", weight: 1.5 },
    { name: "category", weight: 0.3 },
  ],
});

function literalScore(text: string, q: string): number | null {
  const t = text.toLowerCase();
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.split(/[\s+()/,-]+/).some((w) => w.startsWith(q))) return 2;
  if (t.includes(q)) return 3;
  return null;
}

function bestLiteral(m: Medicine, q: string): MedicineMatch | null {
  let best: MedicineMatch | null = null;
  const gs = literalScore(m.genericName, q);
  if (gs !== null) best = { medicine: m, brand: m.brand, matchedIn: "generic", score: gs, fuzzy: false };
  for (const b of m.brandNames) {
    const bs = literalScore(b, q);
    if (bs !== null && (!best || bs + 0.5 < best.score)) {
      best = { medicine: m, brand: b, matchedIn: "brand", score: bs + 0.5, fuzzy: false };
    }
  }
  return best;
}

export interface MedicineSearchResult {
  /** Primary suggestions, best match first. */
  matches: MedicineMatch[];
  /** Same-category alternatives to the top match. */
  related: Medicine[];
  /** Label for the related section, e.g. "Other Antibiotics". */
  relatedLabel: string;
  /** True when the primary list came only from typo-tolerant matching. */
  fuzzy: boolean;
}

const EMPTY: MedicineSearchResult = { matches: [], related: [], relatedLabel: "", fuzzy: false };

export function searchMedicines(query: string, limit = 8, relatedLimit = 6): MedicineSearchResult {
  const q = query.trim().toLowerCase();
  if (!q) return EMPTY;

  const literal: MedicineMatch[] = [];
  const seen = new Set<string>();
  for (const m of MEDICINES) {
    const hit = bestLiteral(m, q);
    if (hit) {
      literal.push(hit);
      seen.add(m.id);
    }
  }
  literal.sort(
    (a, b) => a.score - b.score || a.medicine.genericName.localeCompare(b.medicine.genericName),
  );

  const matches: MedicineMatch[] = literal.slice(0, limit);

  // Top up with typo-tolerant Fuse results.
  if (matches.length < limit) {
    for (const r of fuse.search(q, { limit: limit * 3 })) {
      if (matches.length >= limit) break;
      if (seen.has(r.item.id)) continue;
      seen.add(r.item.id);
      matches.push({
        medicine: r.item,
        brand: r.item.brand,
        matchedIn: "generic",
        score: 10 + (r.score ?? 0),
        fuzzy: true,
      });
    }
  }

  if (!matches.length) return EMPTY;

  const top = matches[0]!.medicine;
  const inList = new Set(matches.map((m) => m.medicine.id));
  const related = MEDICINES.filter((m) => m.category === top.category && !inList.has(m.id)).slice(
    0,
    relatedLimit,
  );

  return {
    matches,
    related,
    relatedLabel: `Other ${top.category}${/s$/i.test(top.category) ? "" : "s"}`,
    fuzzy: matches.every((m) => m.fuzzy),
  };
}

export function useMedicineSearch(query: string, limit = 8, relatedLimit = 6) {
  return useMemo(() => searchMedicines(query, limit, relatedLimit), [query, limit, relatedLimit]);
}
