import assert from 'node:assert/strict';
import test from 'node:test';
import { createResendSender } from './server.js';

test('converts SMTP messages to private per-recipient Resend batch emails', async () => {
  const requests = [];
  const send = createResendSender({
    key: 'api-key',
    fromEmail: 'newsletter@example.com',
    fromName: 'AzTech Africa',
    fetchImpl: async (url, options) => {
      requests.push({ url, ...options });
      return { ok: true, text: async () => JSON.stringify({ data: [{ id: 'message-1' }, { id: 'message-2' }] }) };
    },
  });
  const raw = Buffer.from('From: newsletter@example.com\r\nReply-To: editor@example.com\r\nSubject: Weekly update\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Regional technology news</p>');

  const result = await send(raw, [{ address: 'reader1@example.net' }, { address: 'reader2@example.net' }]);

  assert.equal(requests[0].url, 'https://api.resend.com/emails/batch');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].headers.authorization, 'Bearer api-key');
  const payload = JSON.parse(requests[0].body);
  assert.equal(payload.length, 2);
  assert.equal(payload[0].from, 'AzTech Africa <newsletter@example.com>');
  assert.deepEqual(payload[0].to, ['reader1@example.net']);
  assert.deepEqual(payload[1].to, ['reader2@example.net']);
  assert.equal(payload[0].subject, 'Weekly update');
  assert.equal(payload[0].html, '<p>Regional technology news</p>');
  assert.equal(payload[0].reply_to, 'editor@example.com');
  assert.deepEqual(result, [{ data: [{ id: 'message-1' }, { id: 'message-2' }] }]);
});

test('accepts Resend responses that resolve JSON without a raw text body', async () => {
  const requests = [];
  const send = createResendSender({
    key: 'api-key',
    fromEmail: 'newsletter@example.com',
    fetchImpl: async (url, options) => {
      requests.push({ url, ...options });
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 'message-2' }] }) };
    },
  });

  const result = await send(Buffer.from('Subject: Test\r\n\r\nHello'), ['reader@example.net']);

  assert.equal(requests[0].url, 'https://api.resend.com/emails/batch');
  assert.deepEqual(result, [{ data: [{ id: 'message-2' }] }]);
});

test('returns a retryable SMTP failure when Resend rate limits a message', async () => {
  const send = createResendSender({
    key: 'api-key',
    fromEmail: 'newsletter@example.com',
    fetchImpl: async () => ({ ok: false, status: 429, text: async () => JSON.stringify({ message: 'Rate limited.' }) }),
  });

  await assert.rejects(send(Buffer.from('Subject: Test\r\n\r\nHello'), ['reader@example.net']), (error) => error.responseCode === 451 && /Rate limited/.test(error.message));
});

test('uses individual Resend requests for messages with attachments', async () => {
  const requests = [];
  const send = createResendSender({
    key: 'api-key',
    fromEmail: 'newsletter@example.com',
    fetchImpl: async (url, options) => {
      requests.push({ url, ...options });
      return { ok: true, text: async () => JSON.stringify({ id: `message-${requests.length}` }) };
    },
  });
  const raw = Buffer.from('Subject: Report\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="part"\r\n\r\n--part\r\nContent-Type: text/plain\r\n\r\nHello\r\n--part\r\nContent-Type: text/plain; name="report.txt"\r\nContent-Disposition: attachment; filename="report.txt"\r\n\r\nQuarterly report\r\n--part--');

  await send(raw, ['reader1@example.net', 'reader2@example.net']);

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://api.resend.com/emails');
  const payload = JSON.parse(requests[0].body);
  assert.deepEqual(payload.to, ['reader1@example.net']);
  assert.deepEqual(payload.attachments, [{ filename: 'report.txt', content: Buffer.from('Quarterly report').toString('base64'), content_type: 'text/plain' }]);
});

test('splits recipient lists into Resend batches of at most 100', async () => {
  const requests = [];
  const send = createResendSender({
    key: 'api-key',
    fromEmail: 'newsletter@example.com',
    fetchImpl: async (url, options) => {
      requests.push({ url, ...options });
      return { ok: true, text: async () => JSON.stringify({ data: [] }) };
    },
  });

  await send(Buffer.from('Subject: Test\r\n\r\nHello'), Array.from({ length: 101 }, (_, index) => `reader${index}@example.net`));

  assert.deepEqual(requests.map((request) => JSON.parse(request.body).length), [100, 1]);
});