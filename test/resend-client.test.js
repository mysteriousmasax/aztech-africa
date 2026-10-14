import assert from 'node:assert/strict';
import test from 'node:test';
import { createResendClient } from '../server/resend-client.js';

test('sends confirmation mail through Resend HTTPS API', async () => {
  let request;
  const client = createResendClient({
    apiKey: 'api-key',
    fetchImpl: async (url, options) => {
      request = { url, ...options };
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'message-1' }) };
    },
  });
  const message = {
    from: 'AzTech Africa <newsletter@example.com>',
    to: ['reader@example.net'],
    subject: 'Confirm',
    html: '<p>Confirm</p>',
    text: 'Confirm',
  };

  const result = await client.send(message);

  assert.equal(client.configured, true);
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.headers.authorization, 'Bearer api-key');
  assert.deepEqual(JSON.parse(request.body), message);
  assert.deepEqual(result, { id: 'message-1' });
});

test('accepts fetch responses that expose parsed JSON instead of raw text', async () => {
  const client = createResendClient({
    apiKey: 'api-key',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ id: 'message-2' }) }),
  });

  const result = await client.send({
    from: 'AzTech Africa <newsletter@example.com>',
    to: ['reader@example.net'],
    subject: 'Confirm',
    html: '<p>Confirm</p>',
    text: 'Confirm',
  });

  assert.deepEqual(result, { id: 'message-2' });
});

test('reports Resend API rejection without exposing request credentials', async () => {
  const client = createResendClient({
    apiKey: 'api-key',
    fetchImpl: async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ message: 'Unauthorized.' }) }),
  });

  await assert.rejects(client.send({}), /Unauthorized/);
});