import { timingSafeEqual } from 'node:crypto';
import { simpleParser } from 'mailparser';
import { pathToFileURL } from 'node:url';
import { SMTPServer } from 'smtp-server';

const port = Number(process.env.SMTP_RELAY_PORT || 2525);
const username = process.env.SMTP_RELAY_USER;
const password = process.env.SMTP_RELAY_PASSWORD;
const apiKey = process.env.RESEND_API_KEY;
const senderEmail = process.env.RESEND_FROM_EMAIL;
const senderName = process.env.RESEND_FROM_NAME || 'AzTech Africa';
const apiUrl = 'https://api.resend.com/emails';

async function readResponsePayload(response) {
  if (!response || typeof response !== 'object') return {};
  if (response.status === 204) return {};
  if (typeof response.json === 'function') {
    try {
      return await response.json();
    } catch {
      // Fall back to raw text parsing for custom fetch wrappers returning strings.
    }
  }
  if (typeof response.text !== 'function') return {};
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return { message: raw }; }
}

function matchesSecret(value, expected) {
  if (typeof value !== 'string' || typeof expected !== 'string') return false;
  const valueBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return valueBytes.length === expectedBytes.length && timingSafeEqual(valueBytes, expectedBytes);
}

export function createResendSender({ key, fromEmail, fromName = 'AzTech Africa', fetchImpl = globalThis.fetch }) {
  if (!key || !fromEmail) throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL are required.');
  return async function sendRawEmail(raw, recipients) {
    const parsed = await simpleParser(raw);
    const addresses = [...new Set((recipients || []).map((recipient) => typeof recipient === 'string' ? recipient : recipient.address).filter(Boolean))];
    if (!addresses.length || addresses.length > 2000) {
      throw Object.assign(new Error('A message must have between 1 and 2000 recipients.'), { responseCode: 550 });
    }
    const htmlContent = typeof parsed.html === 'string' ? parsed.html : undefined;
    const textContent = parsed.text || (htmlContent ? htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    if (!htmlContent && !textContent) throw Object.assign(new Error('Message has no text or HTML body.'), { responseCode: 550 });
    const attachments = parsed.attachments?.map((attachment) => ({
      filename: attachment.filename || 'attachment',
      content: attachment.content.toString('base64'),
      ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
    }));
    const baseMessage = {
      from: `${fromName} <${fromEmail}>`,
      subject: parsed.subject || '(No subject)',
      ...(htmlContent ? { html: htmlContent } : {}),
      ...(textContent ? { text: textContent } : {}),
      ...(parsed.replyTo?.value?.[0]?.address ? { reply_to: parsed.replyTo.value[0].address } : {}),
      ...(attachments?.length ? { attachments } : {}),
    };
    const sendRequest = async (url, message) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify(message),
          signal: controller.signal,
        });
        const payload = await readResponsePayload(response);
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          throw Object.assign(new Error(payload.message || payload.error || 'Resend rejected the message.'), { responseCode: retryable ? 451 : 550 });
        }
        return payload;
      } catch (error) {
        if (error.responseCode) throw error;
        throw Object.assign(new Error(error.name === 'AbortError' ? 'Resend timed out.' : 'Unable to reach Resend.'), { responseCode: 451 });
      } finally {
        clearTimeout(timeout);
      }
    };

    if (attachments?.length) {
      const results = [];
      for (const email of addresses) {
        results.push(await sendRequest(apiUrl, { ...baseMessage, to: [email] }));
      }
      return results;
    }

    const results = [];
    for (let index = 0; index < addresses.length; index += 100) {
      const messages = addresses.slice(index, index + 100).map((email) => ({ ...baseMessage, to: [email] }));
      results.push(await sendRequest(`${apiUrl}/batch`, messages));
    }
    return results;
  };
}

export function createSmtpRelay({ sendRawEmail, relayUsername, relayPassword }) {
  return new SMTPServer({
    authOptional: false,
    authMethods: ['PLAIN', 'LOGIN'],
    allowInsecureAuth: true,
    maxMessageSize: 15 * 1024 * 1024,
    onAuth(auth, session, callback) {
      if (!matchesSecret(auth.username, relayUsername) || !matchesSecret(auth.password, relayPassword)) {
        callback(new Error('Invalid SMTP credentials.'));
        return;
      }
      callback(null, { user: auth.username });
    },
    onData(stream, session, callback) {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', async () => {
        try {
          await sendRawEmail(Buffer.concat(chunks), session.envelope.rcptTo);
          callback(null, 'Accepted by Resend.');
        } catch (error) {
          callback(Object.assign(new Error(error.message), { responseCode: error.responseCode || 451 }));
        }
      });
    },
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!username || !password || !apiKey || !senderEmail) {
    throw new Error('Set SMTP_RELAY_USER, SMTP_RELAY_PASSWORD, RESEND_API_KEY, and RESEND_FROM_EMAIL before starting the relay.');
  }
  const server = createSmtpRelay({ sendRawEmail: createResendSender({ key: apiKey, fromEmail: senderEmail, fromName: senderName }), relayUsername: username, relayPassword: password });
  server.listen(port, '0.0.0.0', () => console.log(`Private SMTP-to-HTTPS relay listening on port ${port}.`));
}