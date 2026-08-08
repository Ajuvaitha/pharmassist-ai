export const CHAT_WEBHOOK_URL =
  'https://api.agents.snsihub.ai/webhook/pharmassist-chat'

const EMPTY_REPLY_FALLBACK = 'Sorry, I could not produce an answer for that.'

/**
 * POST a chat turn to the SNS webhook and return the assistant reply text.
 * Rejects on network failure or a non-2xx response; returns a fallback string
 * when the webhook responds 2xx but with no usable `reply`.
 */
export async function sendChatMessage(
  message: string,
  sessionId: string,
  patientMrn: string,
): Promise<string> {
  const res = await fetch(CHAT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, patientMrn }),
  })
  if (!res.ok) throw new Error(`Chat webhook failed: HTTP ${res.status}`)
  const data: unknown = await res.json().catch(() => null)
  const reply = (data as { reply?: unknown } | null)?.reply
  return typeof reply === 'string' && reply.trim() ? reply : EMPTY_REPLY_FALLBACK
}
