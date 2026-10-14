import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSubscriptionStore, validateSubscription } from '../server/subscription-store.js';

const validSubscription = {
  email: 'Reader@Example.com',
  consent: true,
  swahiliSummary: true,
  country: 'Tanzania',
  interests: ['fintech', 'funding'],
  source: 'hero',
};

test('requires affirmative newsletter consent', () => {
  assert.throws(() => validateSubscription({ ...validSubscription, consent: false }), /agree to receive/);
});

test('rejects unsupported country and reader interests', () => {
  assert.throws(() => validateSubscription({ ...validSubscription, country: 'Atlantis' }), /supported country/);
  assert.throws(() => validateSubscription({ ...validSubscription, interests: ['day-trading'] }), /valid newsletter interests/);
});

test('normalizes email and persists subscription preferences', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-newsletter-'));
  try {
    const filePath = join(directory, 'subscribers.json');
    const result = await createSubscriptionStore({ filePath }).subscribe(validSubscription);
    const [saved] = JSON.parse(await readFile(filePath, 'utf8'));
    assert.equal(result.alreadySubscribed, false);
    assert.equal(saved.email, 'reader@example.com');
    assert.equal(saved.swahiliSummary, true);
    assert.equal(saved.country, 'Tanzania');
    assert.deepEqual(saved.interests, ['fintech', 'funding']);
    assert.equal(saved.source, 'hero');
    assert.ok(saved.consentedAt);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('updates preferences for an existing email without creating a duplicate', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-newsletter-'));
  try {
    const filePath = join(directory, 'subscribers.json');
    const store = createSubscriptionStore({ filePath });
    await store.subscribe(validSubscription);
    const result = await store.subscribe({ ...validSubscription, swahiliSummary: false, country: 'Kenya', interests: ['events'], source: 'newsletter' });
    const saved = JSON.parse(await readFile(filePath, 'utf8'));
    assert.equal(result.alreadySubscribed, true);
    assert.equal(result.preferencesUpdated, true);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].swahiliSummary, false);
    assert.equal(saved[0].country, 'Kenya');
    assert.deepEqual(saved[0].interests, ['events']);
    assert.equal(saved[0].source, 'newsletter');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reads wrapped local subscriber data for statistics without rewriting it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-newsletter-'));
  try {
    const filePath = join(directory, 'subscribers.json');
    const data = {
      value: [
        { email: 'active@example.com', status: 'active' },
        { email: 'pending@example.com', status: 'pending' },
      ],
      Count: 2,
    };
    await writeFile(filePath, JSON.stringify(data));
    const stats = await createSubscriptionStore({ filePath }).stats();
    assert.deepEqual(stats, { confirmedSubscribers: 1 });
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), data);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('exports only active and unsubscribed contacts for mailing-list sync', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-newsletter-'));
  try {
    const filePath = join(directory, 'subscribers.json');
    await writeFile(filePath, JSON.stringify({ value: [
      { email: 'active@example.com', status: 'active', country: 'Kenya', interests: ['ai'], swahiliSummary: true },
      { email: 'pending@example.com', status: 'pending' },
      { email: 'unsubscribed@example.com', status: 'unsubscribed' },
    ] }));
    const audience = await createSubscriptionStore({ filePath }).audience();
    assert.deepEqual(audience, [
      { email: 'active@example.com', status: 'active', country: 'Kenya', interests: ['ai'], swahiliSummary: true },
      { email: 'unsubscribed@example.com', status: 'unsubscribed', country: 'Tanzania', interests: [], swahiliSummary: false },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('lists CRM contacts across all statuses with search, pagination, and welcome timestamps', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-newsletter-crm-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, 'subscribers.json');
  await writeFile(filePath, JSON.stringify([
    { id: '1', email: 'active@example.com', status: 'active', country: 'Kenya', interests: ['ai'], source: 'hero', swahiliSummary: true, consentedAt: '2026-01-01', welcomeSentAt: '2026-01-02' },
    { id: '2', email: 'pending@example.com', status: 'pending', country: 'Tanzania', interests: [], source: 'newsletter' },
    { id: '3', email: 'unsubscribed@example.com', status: 'unsubscribed', country: 'Rwanda', interests: ['events'], source: 'newsletter' },
  ]));

  const crm = await createSubscriptionStore({ filePath }).crm({ search: 'example.com', status: 'active', page: 1, perPage: 1 });
  assert.deepEqual(crm.counts, { pending: 1, active: 1, unsubscribed: 1 });
  assert.equal(crm.total, 1);
  assert.equal(crm.contacts[0].email, 'active@example.com');
  assert.equal(crm.contacts[0].welcomeSentAt, '2026-01-02');
  assert.equal(crm.contacts[0].swahiliSummary, true);
});

test('continues processing subscriptions after a storage failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-newsletter-'));
  try {
    const blocker = join(directory, 'not-a-directory');
    await writeFile(blocker, 'temporary');
    const store = createSubscriptionStore({ filePath: join(blocker, 'subscribers.json') });
    await assert.rejects(store.subscribe(validSubscription));
    await rm(blocker);
    await mkdir(blocker);
    const result = await store.subscribe(validSubscription);
    assert.equal(result.alreadySubscribed, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('initializes PostgreSQL storage and updates repeat signup preferences', async () => {
  const subscribers = new Map();
  const queries = [];
  const pool = {
    async query(sql, values = []) {
      queries.push(sql);
      if (sql.includes('CREATE TABLE') || sql.includes('ALTER TABLE')) return { rowCount: null, rows: [] };
      if (sql.includes('INSERT INTO newsletter_subscribers')) {
        if (subscribers.has(values[1])) return { rowCount: 0, rows: [] };
        subscribers.set(values[1], { email: values[1], swahiliSummary: values[2], country: values[3], interests: values[4], source: values[5], status: 'pending', verifyHash: values[6], manageHash: values[7], expires: values[8] });
        return { rowCount: 1, rows: [{ id: values[0] }] };
      }
      if (sql.includes("status = 'pending'") && sql.includes('verification_token_hash = $6')) {
        const record = subscribers.get(values[0]);
        if (!record || record.status !== 'pending') return { rowCount: 0, rows: [] };
        Object.assign(record, { swahiliSummary: values[1], country: values[2], interests: values[3], source: values[4], verifyHash: values[5], manageHash: values[6], expires: values[7] });
        return { rowCount: 1, rows: [{ id: 'pending-refresh' }] };
      }
      if (sql.includes('verification_token_hash = $1')) {
        const record = [...subscribers.values()].find((item) => item.verifyHash === values[0] && item.status === 'pending');
        if (!record) return { rowCount: 0, rows: [] };
        record.status = 'active';
        record.verifyHash = null;
        return { rowCount: 1, rows: [{ id: 'verified' }] };
      }
      if (sql.includes('manage_token_hash = $1') && sql.includes('SELECT')) {
        const record = [...subscribers.values()].find((item) => item.manageHash === values[0] && ['active', 'pending'].includes(item.status));
        return { rowCount: record ? 1 : 0, rows: record ? [{ email: record.email, swahili_summary: record.swahiliSummary, country: record.country, interests: record.interests, status: record.status }] : [] };
      }
      if (sql.includes('manage_token_hash = $1') && sql.includes('swahili_summary = $2')) {
        const record = [...subscribers.values()].find((item) => item.manageHash === values[0] && item.status === 'active');
        if (!record) return { rowCount: 0, rows: [] };
        record.swahiliSummary = values[1];
        record.country = values[2];
        record.interests = values[3];
        return { rowCount: 1, rows: [{ id: 'managed' }] };
      }
      if (sql.includes('manage_token_hash = $1') && sql.includes("status = 'unsubscribed'")) {
        const record = [...subscribers.values()].find((item) => item.manageHash === values[0] && ['active', 'pending'].includes(item.status));
        if (!record) return { rowCount: 0, rows: [] };
        record.status = 'unsubscribed';
        return { rowCount: 1, rows: [{ id: 'unsubscribed' }] };
      }
      if (sql.includes('UPDATE newsletter_subscribers')) {
        const existing = subscribers.get(values[0]);
        if (!existing || existing.swahiliSummary === values[1]) return { rowCount: 0, rows: [] };
        subscribers.set(values[0], { swahiliSummary: values[1], source: values[2] });
        return { rowCount: 1, rows: [{ id: 'existing' }] };
      }
      throw new Error('Unexpected SQL query.');
    },
  };
  let sentTokens;
  const store = createSubscriptionStore({ pool, sendVerification: async (tokens) => { sentTokens = tokens; return true; } });
  await store.initialize();
  const created = await store.subscribe(validSubscription);
  const repeated = await store.subscribe({ ...validSubscription, swahiliSummary: false });
  assert.equal(created.alreadySubscribed, false);
  assert.equal(created.pending, true);
  assert.equal(created.emailSent, true);
  assert.equal(repeated.alreadySubscribed, true);
  assert.equal(repeated.pending, true);
  assert.ok(sentTokens.verificationToken);
  assert.ok(sentTokens.manageToken);
  assert.equal(await store.verify(sentTokens.verificationToken), true);
  assert.equal((await store.manage(sentTokens.manageToken)).status, 'active');
  assert.equal(await store.updatePreferences(sentTokens.manageToken, { swahiliSummary: true, country: 'Kenya', interests: ['funding', 'events'] }), true);
  assert.equal((await store.manage(sentTokens.manageToken)).country, 'Kenya');
  assert.deepEqual((await store.manage(sentTokens.manageToken)).interests, ['funding', 'events']);
  assert.equal(await store.unsubscribe(sentTokens.manageToken), true);
  assert.equal(await store.manage(sentTokens.manageToken), null);
  assert.ok(queries.some((sql) => sql.includes('CREATE TABLE')));
});
