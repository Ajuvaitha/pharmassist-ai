/**
 * Google Cloud Vision handwriting OCR (server-only).
 * Uses DOCUMENT_TEXT_DETECTION, which handles messy/cursive handwriting far
 * better than generic TEXT_DETECTION.
 */

export interface VisionResult {
  text: string;
  error?: string;
}

/** Strip data-url prefix and whitespace to get raw base64 content. */
export function toBase64Content(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return (comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl).trim();
}

/** Trim whitespace/newlines and drop OCR noise characters. */
export function cleanRecognizedText(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, " ")
    .replace(/[^A-Za-z0-9 .+/-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function recognizeWithVision(dataUrl: string): Promise<VisionResult> {
  const apiKey = process.env["GOOGLE_CLOUD_VISION_API_KEY"];
  if (!apiKey) return { text: "", error: "OCR is not configured yet." };

  const content = toBase64Content(dataUrl);
  if (!content) return { text: "", error: "Empty image." };

  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              imageContext: { languageHints: ["en"] },
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      console.error("Vision API error", res.status, await res.text());
      return { text: "", error: "Recognition service error." };
    }

    const json = (await res.json()) as {
      responses?: { fullTextAnnotation?: { text?: string }; error?: { message?: string } }[];
    };
    const first = json.responses?.[0];
    if (first?.error?.message) {
      console.error("Vision API response error", first.error.message);
      return { text: "", error: "Recognition service error." };
    }
    return { text: cleanRecognizedText(first?.fullTextAnnotation?.text ?? "") };
  } catch (err) {
    console.error("Vision API call failed", err);
    return { text: "", error: "Recognition request failed." };
  }
}
