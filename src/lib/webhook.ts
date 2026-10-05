// Render-complete callback (to-do A1, 2026-10-05): n8n passes its own resume URL and Remotion Lambda calls it
// when the render finishes, so the Render Engine waits once instead of polling every 15 s. Only https URLs on
// the TRS n8n host are accepted, so the endpoint can't be used to make Lambda call anywhere else.
export const WEBHOOK_HOST = 'satiah.app.n8n.cloud';

export function webhookFor(raw: unknown): { url: string; secret: null } | null {
  if (typeof raw !== 'string' || raw.length > 1000) return null;
  const m = raw.match(/^https:\/\/([^\/?#:]+)(\/[^\s]*)?$/i);
  if (!m || m[1].toLowerCase() !== WEBHOOK_HOST) return null;
  return { url: raw, secret: null };
}
