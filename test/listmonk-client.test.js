import assert from 'node:assert/strict';
import test from 'node:test';
import { createListmonkClient } from '../server/listmonk-client.js';

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify({ data }) };
}

test('synchronizes active and unsubscribed contacts before starting a campaign', async () => {
  const calls = [];
  const client = createListmonkClient({
    url: 'https://mail.example.test',
    username: 'api-user',
    token: 'api-token',
    fetchImpl: async (url, options) => {
      const path = url.replace('https://mail.example.test', '');
      calls.push({ path, ...options });
      if (path === '/api/campaigns/42') return jsonResponse({ id: 42, lists: [{ id: 3 }] });
      if (path.startsWith('/api/lists')) return jsonResponse({ results: [{ id: 3 }] });
      if (path === '/api/subscribers?page=1&per_page=500') return jsonResponse({
        results: [{ id: 81, email: 'old@example.com', status: 'enabled', lists: [{ id: 3, subscription_status: 'confirmed' }] }],
        total: 1,
        per_page: 500,
      });
      if (path === '/api/subscribers' && options.method === 'POST') return jsonResponse({ id: 82 });
      if (path === '/api/subscribers/lists' && options.method === 'PUT') return jsonResponse({});
      if (path === '/api/campaigns/42/status') return jsonResponse({ id: 42, status: 'running' });
      throw new Error(`Unexpected Listmonk request: ${options.method} ${path}`);
    },
  });

  const result = await client.sendCampaign('42', [
    { email: 'new@example.com', status: 'active', country: 'Tanzania', interests: ['fintech'], swahiliSummary: true },
    { email: 'english@example.com', status: 'active', country: 'Kenya', interests: ['funding'], swahiliSummary: false },
    { email: 'old@example.com', status: 'unsubscribed' },
    { email: 'waiting@example.com', status: 'pending' },
  ]);

  const subscriberCreates = calls.filter((call) => call.path === '/api/subscribers' && call.method === 'POST');
  const subscriberCreate = calls.findIndex((call) => call.path === '/api/subscribers' && call.method === 'POST');
  const unsubscribe = calls.findIndex((call) => call.path === '/api/subscribers/lists');
  const startCampaign = calls.findIndex((call) => call.path === '/api/campaigns/42/status');
  assert.ok(subscriberCreate >= 0);
  assert.ok(unsubscribe > subscriberCreate);
  assert.ok(startCampaign > unsubscribe);
  assert.equal(JSON.parse(calls[subscriberCreate].body).email, 'new@example.com');
  assert.deepEqual(subscriberCreates.map((call) => JSON.parse(call.body).attribs.swahiliSummary), [true, false]);
  assert.deepEqual(JSON.parse(calls[unsubscribe].body), { ids: [81], action: 'unsubscribe', target_list_ids: [3] });
  assert.deepEqual(JSON.parse(calls[startCampaign].body), { status: 'running' });
  assert.equal(result.status, 'running');
});

test('preserves per-subscriber language conditionals when creating a campaign', async () => {
  const calls = [];
  const client = createListmonkClient({
    url: 'https://mail.example.test',
    username: 'api-user',
    token: 'api-token',
    fetchImpl: async (url, options) => {
      const path = url.replace('https://mail.example.test', '');
      calls.push({ path, ...options });
      if (path.startsWith('/api/lists')) return jsonResponse({ results: [{ id: 3 }] });
      if (path === '/api/campaigns' && options.method === 'POST') return jsonResponse({ id: 99 });
      throw new Error(`Unexpected Listmonk request: ${options.method} ${path}`);
    },
  });
  const subject = 'East Africa Weekly{{ if .Subscriber.Attribs.swahiliSummary }} / Habari za Wiki{{ end }}';
  const body = '<h1>Weekly signals</h1>{{ if .Subscriber.Attribs.swahiliSummary }}<h1>Habari za wiki</h1>{{ end }}';

  await client.createCampaign({ name: 'Bilingual brief', subject, body, listId: '3' });

  const payload = JSON.parse(calls.find((call) => call.path === '/api/campaigns').body);
  assert.equal(payload.subject, subject);
  assert.equal(payload.body, body);
});

test('updates and reschedules an existing campaign through valid Listmonk status transitions', async () => {
  const calls = [];
  const campaign = { id: 42, status: 'scheduled', name: 'Existing issue', subject: 'Old subject', body: '<p>Old issue</p>', lists: [{ id: 3 }], tags: ['legacy'] };
  const client = createListmonkClient({
    url: 'https://mail.example.test',
    username: 'api-user',
    token: 'api-token',
    fetchImpl: async (url, options) => {
      const path = url.replace('https://mail.example.test', '');
      calls.push({ path, ...options });
      if (path.startsWith('/api/lists?')) return jsonResponse({ results: [{ id: 3 }] });
      if (path === '/api/campaigns/42' && options.method === 'GET') return jsonResponse(campaign);
      if (path === '/api/campaigns/42' && options.method === 'PUT') {
        Object.assign(campaign, JSON.parse(options.body));
        return jsonResponse(campaign);
      }
      if (path === '/api/campaigns/42/status') {
        campaign.status = JSON.parse(options.body).status;
        return jsonResponse(campaign);
      }
      throw new Error(`Unexpected Listmonk request: ${options.method} ${path}`);
    },
  });

  const sendAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const updated = await client.updateCampaign('42', { name: 'Updated issue', subject: 'New subject', body: '<p>Updated issue</p>', listId: '3', sendAt });
  const statusCalls = calls.filter((call) => call.path === '/api/campaigns/42/status').map((call) => JSON.parse(call.body).status);
  const updateCall = calls.find((call) => call.path === '/api/campaigns/42' && call.method === 'PUT');
  assert.deepEqual(statusCalls, []);
  assert.equal(JSON.parse(updateCall.body).name, 'Updated issue');
  assert.equal(JSON.parse(updateCall.body).send_at, sendAt);
  assert.equal(updated.status, 'scheduled');
  assert.deepEqual(JSON.parse(updateCall.body).tags, ['legacy', 'aztech-africa']);

  await client.updateCampaign('42', { name: 'Keep as draft', subject: 'Review', body: '<p>Review</p>', listId: '3' });
  assert.deepEqual(calls.filter((call) => call.path === '/api/campaigns/42/status').map((call) => JSON.parse(call.body).status), ['draft']);
});

test('rejects a campaign schedule time in the past', async () => {
  const client = createListmonkClient({
    url: 'https://mail.example.test',
    username: 'api-user',
    token: 'api-token',
    fetchImpl: async (url) => {
      if (url.includes('/api/lists?')) return jsonResponse({ results: [{ id: 3 }] });
      throw new Error(`Unexpected Listmonk request: ${url}`);
    },
  });
  await assert.rejects(client.createCampaign({ name: 'Past issue', subject: 'Past issue', body: '<p>Issue</p>', listId: '3', sendAt: '2020-01-01T12:00:00Z' }), /future/);
});

test('sends a scheduled campaign now by unscheduling before audience sync and start', async () => {
  const calls = [];
  const campaign = { id: 42, status: 'scheduled', lists: [{ id: 3 }] };
  const client = createListmonkClient({
    url: 'https://mail.example.test',
    username: 'api-user',
    token: 'api-token',
    fetchImpl: async (url, options) => {
      const path = url.replace('https://mail.example.test', '');
      calls.push({ path, ...options });
      if (path === '/api/campaigns/42') return jsonResponse(campaign);
      if (path.startsWith('/api/lists?')) return jsonResponse({ results: [{ id: 3 }] });
      if (path === '/api/subscribers?page=1&per_page=500') return jsonResponse({ results: [], total: 0, per_page: 500 });
      if (path === '/api/campaigns/42/status') {
        campaign.status = JSON.parse(options.body).status;
        return jsonResponse(campaign);
      }
      throw new Error(`Unexpected Listmonk request: ${options.method} ${path}`);
    },
  });

  await client.sendCampaign('42', []);
  const statusChanges = calls.filter((call) => call.path === '/api/campaigns/42/status').map((call) => JSON.parse(call.body).status);
  assert.deepEqual(statusChanges, ['draft', 'running']);
});

test('creates a private newsletter list and syncs the audience when none exists', async () => {
  const calls = [];
  let createdList = null;
  const client = createListmonkClient({
    url: 'https://mail.example.test',
    username: 'api-user',
    token: 'api-token',
    fetchImpl: async (url, options) => {
      const path = url.replace('https://mail.example.test', '');
      calls.push({ path, ...options });
      if (path.startsWith('/api/lists?')) return jsonResponse({ results: createdList ? [createdList] : [] });
      if (path === '/api/lists' && options.method === 'POST') {
        const payload = JSON.parse(options.body);
        createdList = { id: 12, ...payload };
        return jsonResponse(createdList);
      }
      if (path === '/api/subscribers?page=1&per_page=500') return jsonResponse({ results: [], total: 0, per_page: 500 });
      if (path === '/api/subscribers' && options.method === 'POST') return jsonResponse({ id: 90 });
      throw new Error(`Unexpected Listmonk request: ${options.method} ${path}`);
    },
  });

  const result = await client.setupAudience([{ email: 'reader@example.test', status: 'active', swahiliSummary: true }]);

  const createCall = calls.find((call) => call.path === '/api/lists' && call.method === 'POST');
  assert.equal(JSON.parse(createCall.body).type, 'private');
  assert.equal(JSON.parse(createCall.body).status, 'active');
  assert.equal(result.list.id, 12);
  assert.equal(result.created, true);
  assert.equal(result.sync.created, 1);
});

test('loads all campaign history pages for the admin dashboard', async () => {
  const paths = [];
  const client = createListmonkClient({
    url: 'https://mail.example.test',
    username: 'api-user',
    token: 'api-token',
    fetchImpl: async (url) => {
      const path = url.replace('https://mail.example.test', '');
      paths.push(path);
      if (path.startsWith('/api/lists?')) return jsonResponse({ results: [] });
      if (path.startsWith('/api/campaigns?page=1&')) return jsonResponse({ results: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })), total: 101, per_page: 100 });
      if (path.startsWith('/api/campaigns?page=2&')) return jsonResponse({ results: [{ id: 101 }], total: 101, per_page: 100 });
      throw new Error(`Unexpected Listmonk request: ${path}`);
    },
  });

  const dashboard = await client.dashboard(12);
  assert.equal(dashboard.campaigns.length, 101);
  assert.equal(dashboard.campaigns.at(-1).id, 101);
  assert.ok(paths.some((path) => path.includes('page=2')));
});