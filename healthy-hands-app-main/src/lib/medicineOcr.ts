/**
 * medicineOcr.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side medical handwriting recognition pipeline.
 *
 * Pipeline:
 *   canvas PNG  →  Tesseract.js WASM  →  raw OCR text
 *                                       ↓
 *                               medicalClean()   (noise removal)
 *                                       ↓
 *                               correctMedicalOcr()  (letter-pair fixes)
 *                                       ↓
 *                               bestMedicineMatch()  (fuzzy medicine lookup)
 *                                       ↓
 *                               final recognized text
 *
 * No API key required — Tesseract runs entirely in the browser via WebAssembly.
 */

import { createWorker, PSM } from "tesseract.js";
import { MEDICINES } from "@/data/medicines";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  OCR Noise cleaning                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Remove characters that are never part of a medicine name and collapse runs
 * of whitespace to a single space.
 */
export function medicalClean(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")          // newlines → space
    .replace(/[^A-Za-z0-9 .+\-/(),]/g, " ") // keep only medicine-safe chars
    .replace(/\s{2,}/g, " ")             // collapse multiple spaces
    .trim();
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Common OCR confusion pairs for medical handwriting                          */
/* ─────────────────────────────────────────────────────────────────────────── */

// Each entry: [wrong pattern (regex), correct replacement]
const MEDICINE_OCR_FIXES: [RegExp, string][] = [
  // Letter-pair swaps common in messy handwriting
  [/rn/g,  "m"],   // "rn" → "m"  (amoxicillin)
  [/cl/g,  "d"],   // "cl" → "d"  (Clindamycin confusion)
  [/li/g,  "li"],  // keep
  [/0/g,   "o"],   // digit zero → letter o
  [/1/g,   "l"],   // digit one → letter l (in middle of word)
  [/5/g,   "s"],   // digit five → s
  [/vv/g,  "w"],   // double-v → w
  [/ii/g,  "n"],   // double-i → n in some fonts
];

/**
 * Apply OCR fix pairs to a raw string.
 * Only applied to actual letter tokens, not to dosage numbers.
 */
export function correctMedicalOcr(text: string): string {
  // Split on spaces, fix each token that looks like a word (no digits as majority)
  return text
    .split(" ")
    .map((token) => {
      const digitCount = (token.match(/\d/g) ?? []).length;
      const letterCount = (token.match(/[a-zA-Z]/g) ?? []).length;
      // Only apply letter-swap fixes when mostly letters (medicine names)
      if (letterCount > digitCount && letterCount >= 2) {
        let t = token.toLowerCase();
        for (const [pattern, repl] of MEDICINE_OCR_FIXES) {
          t = t.replace(pattern, repl);
        }
        return t;
      }
      return token;
    })
    .join(" ");
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Levenshtein distance for fuzzy medicine name correction                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

/**
 * Given a noisy/corrected OCR text, find the closest medicine name in the
 * MEDICINES dataset using normalized Levenshtein distance.
 * Returns the best matching medicine name, or the original text if no good match.
 */
export function bestMedicineMatch(ocrText: string): string {
  const query = ocrText.trim().toLowerCase();
  if (query.length < 2) return ocrText;

  // Build candidate list: genericName + all brandNames
  type Candidate = { name: string; score: number };
  let best: Candidate | null = null;

  for (const med of MEDICINES) {
    const candidates = [med.genericName, ...med.brandNames];
    for (const candidate of candidates) {
      const cl = candidate.toLowerCase();
      // Quick prefix check to skip obviously wrong candidates
      if (Math.abs(cl.length - query.length) > Math.max(6, query.length * 0.6)) continue;
      // Substring bonus: if query is a substring of the candidate
      if (cl.includes(query)) {
        const score = 0; // perfect substring match
        if (!best || score < best.score) {
          best = { name: med.genericName, score };
        }
        continue;
      }
      const dist = levenshtein(query, cl.slice(0, Math.min(cl.length, query.length + 4)));
      const normalized = dist / Math.max(query.length, cl.length);
      if (normalized < 0.45) {
        if (!best || normalized < best.score) {
          best = { name: med.genericName, score: normalized };
        }
      }
    }
  }

  return best ? best.name : ocrText;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Tesseract.js worker — lazily initialized, reused across calls               */
/* ─────────────────────────────────────────────────────────────────────────── */

let _workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

async function getWorker() {
  if (!_workerPromise) {
    _workerPromise = createWorker("eng", 1, {
      // Point to CDN-hosted Tesseract data so no local files needed
      workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js",
      logger: () => {}, // suppress progress logs
    });
  }
  return _workerPromise;
}

export interface OcrResult {
  /** Cleaned, medicine-corrected text extracted from the handwriting. */
  text: string;
  /** Raw text before any post-processing. */
  rawText: string;
  /** Confidence 0–100 from Tesseract. */
  confidence: number;
  error?: string;
}

/**
 * Run Tesseract.js OCR on a canvas PNG data-URL, apply medical post-processing,
 * and return the best-guess medicine name.
 *
 * Designed to be called on every handwriting pause (via onStrokePause).
 */
export async function recognizeWithTesseract(dataUrl: string): Promise<OcrResult> {
  if (!dataUrl) return { text: "", rawText: "", confidence: 0 };
  try {
    const worker = await getWorker();
    // Set Tesseract parameters optimized for single medicine name recognition
    await worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .+-/()",
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
    });
    const { data } = await worker.recognize(dataUrl);
    const rawText = data.text ?? "";
    const confidence = data.confidence ?? 0;

    // Post-process pipeline
    const cleaned = medicalClean(rawText);
    const corrected = correctMedicalOcr(cleaned);
    const matched = bestMedicineMatch(corrected);

    return { text: matched || corrected || cleaned, rawText, confidence };
  } catch (err) {
    console.error("Tesseract OCR error", err);
    return {
      text: "",
      rawText: "",
      confidence: 0,
      error: "OCR engine error — try writing more clearly",
    };
  }
}
