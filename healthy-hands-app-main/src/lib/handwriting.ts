/**
 * Handwriting recognition bridge.
 *
 * Primary path: Tesseract.js WASM (browser-side, no API key required).
 * Fallback path: Google Cloud Vision API via server function (needs env key).
 *
 * The recognised text is cleaned and medicine-corrected client-side, then
 * fed into the shared Fuse.js medicine search for live suggestions.
 */

import { recognizeWithTesseract } from "@/lib/medicineOcr";
import { recognizeHandwritingFn } from "@/lib/ocr.functions";

export interface HandwritingContext {
  /** Number of completed strokes currently on the pad. */
  strokeCount: number;
  /** Total captured points — a rough proxy for how much has been written. */
  pointCount: number;
}

export interface HandwritingResult {
  text: string;
  confidence?: number;
  error?: string;
}

/**
 * Recognize handwriting from a canvas PNG data-URL.
 *
 * Strategy:
 * 1. Try Tesseract.js (always available, browser WASM).
 * 2. If Tesseract returns low confidence AND a server-side Vision API key is
 *    available, fall back to Google Cloud Vision for a second opinion.
 */
export async function recognizeHandwriting(
  canvasImageData: string,
  ctx: HandwritingContext,
): Promise<HandwritingResult> {
  if (!canvasImageData || ctx.strokeCount === 0) return { text: "" };

  // ── Primary: Tesseract.js (client-side, no key needed) ──────────────────
  try {
    const result = await recognizeWithTesseract(canvasImageData);
    if (result.text && result.confidence > 20) {
      return { text: result.text, confidence: result.confidence };
    }
    // Low confidence → try server OCR as well
    const serverResult = await tryServerOcr(canvasImageData);
    if (serverResult?.text) return serverResult;
    // If server also failed, still return what Tesseract found
    if (result.text) return { text: result.text, confidence: result.confidence };
    if (result.error) return { text: "", error: result.error };
    return { text: "" };
  } catch {
    // Tesseract failed → try server fallback
    const serverResult = await tryServerOcr(canvasImageData);
    if (serverResult) return serverResult;
    return { text: "", error: "Recognition request failed." };
  }
}

async function tryServerOcr(dataUrl: string): Promise<HandwritingResult | null> {
  try {
    const result = await recognizeHandwritingFn({ data: { image: dataUrl } });
    if (result.text) return { text: result.text };
    return null;
  } catch {
    return null;
  }
}
