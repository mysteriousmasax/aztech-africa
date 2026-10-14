const requestTimeoutMs = 15_000;

async function readResponsePayload(response) {
  if (!response || typeof response !== 'object') return {};
  if (response.status === 204) return {};
  if (typeof response.json === 'function') {
    try {
      return await response.json();
    } catch {
      // Fall through to the text parser below for responses that are still returned as raw text.
    }
  }
  if (typeof response.text !== 'function') return {};
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return { message: raw }; }
}

export class ResendError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'ResendError';
    this.statusCode = statusCode;
  }
}

export function createResendClient({ apiKey = process.env.RESEND_API_KEY, fetchImpl = globalThis.fetch } = {}) {
  const configured = Boolean(apiKey);

  async function send(message) {
    if (!configured) throw new ResendError('Resend is not configured. Set RESEND_API_KEY in Railway.', 503);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) throw new ResendError(payload.message || payload.error || `Resend rejected the message (${response.status}).`, response.status);
      return payload;
    } catch (error) {
      if (error instanceof ResendError) throw error;
      throw new ResendError(error.name === 'AbortError' ? 'Resend did not respond in time.' : 'Unable to reach Resend.');
    } finally {
      clearTimeout(timeout);
    }
  }

  return { configured, send };
}