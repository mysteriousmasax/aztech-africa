import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createEditorialStore } from '../server/editorial-store.js';

test('author draft moves through review to the published reader feed', async () => {
  const records = new Map();
  const pool = {
    async query(sql, values = []) {
      if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX') || sql.includes('ALTER TABLE') || sql.includes('UPDATE editorial_articles SET owner_email')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO editorial_articles')) {
        const [id, slug, category, label, tag, readTime, title, cardTitle, description, date, footer, content, countries, topics, metadata, authorEmail, ownerEmail] = values;
        const existing = records.get(id);
        const record = existing || { id, status: 'draft', author_email: authorEmail, owner_email: ownerEmail, reviewer_note: null };
        Object.assign(record, { slug, category, label, tag, read_time: readTime, title, card_title: cardTitle, description, date, footer, content: JSON.parse(content), countries, topics, metadata: JSON.parse(metadata), image_url: values[17], image_alt: values[18] });
        if (existing && values[19] !== 'admin' && existing.owner_email !== authorEmail) return { rows: [], rowCount: 0 };
        if (existing && values[19] !== 'admin' && existing.status === 'needs_edits') record.status = 'draft';
        records.set(id, record);
        return { rows: [record], rowCount: 1 };
      }
      if (sql.includes('author_email=$2')) {
        const record = records.get(values[0]);
        if (!record || record.author_email !== values[1] || !['draft', 'needs_edits'].includes(record.status)) return { rows: [], rowCount: 0 };
        record.status = 'in_review';
        return { rows: [record], rowCount: 1 };
      }
      if (sql.includes("WHERE id=$1 AND status='in_review'")) {
        const record = records.get(values[0]);
        if (!record || record.status !== 'in_review') return { rows: [], rowCount: 0 };
        record.status = values[1];
        record.reviewer_note = values[2];
        return { rows: [record], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE editorial_articles SET status=$2')) {
        const record = records.get(values[0]);
        if (!record) return { rows: [], rowCount: 0 };
        record.status = values[1];
        return { rows: [record], rowCount: 1 };
      }
      if (sql.startsWith('DELETE FROM editorial_articles')) {
        const deleted = records.delete(values[0]);
        return { rows: deleted ? [{ id: values[0] }] : [], rowCount: deleted ? 1 : 0 };
      }
      if (sql.includes("WHERE editorial_articles.status = 'published'")) return { rows: [...records.values()].filter((record) => record.status === 'published'), rowCount: records.size };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const store = createEditorialStore(pool);
  await store.initialize();
  const author = { email: 'writer@example.test', role: 'author' };
  const admin = { email: 'admin@example.test', role: 'admin' };
  const fundingDetails = { kind: 'opportunity', opportunityType: 'grant', amount: 'TZS 2,000,000', deadline: '2027-01-31', sourceUrl: 'https://example.test/opportunity' };
  const draft = await store.saveDraft({ title: 'Funding signals', description: 'New funding in East Africa', countries: ['Kenya'], topics: ['investing'], category: 'opportunity', metadata: fundingDetails, imageUrl: 'https://example.test/funding.jpg', imageAlt: 'A founder presenting a funding opportunity' }, author);
  assert.equal(draft.status, 'draft');
  assert.equal(draft.slug, 'funding-signals');
  assert.deepEqual(draft.metadata, fundingDetails);
  const review = await store.submitForReview(draft.id, author);
  assert.equal(review.status, 'in_review');
  const published = await store.review(draft.id, 'publish', '');
  assert.equal(published.status, 'published');
  assert.deepEqual(published.metadata, fundingDetails);
  assert.equal(published.imageUrl, 'https://example.test/funding.jpg');
  assert.equal(published.imageAlt, 'A founder presenting a funding opportunity');
  const adminEdit = await store.saveDraft({ ...published, title: 'Funding signals, updated', description: 'Updated coverage of new funding in East Africa.' }, admin);
  assert.equal(adminEdit.title, 'Funding signals, updated');
  assert.equal(adminEdit.status, 'published');
  assert.equal(adminEdit.authorEmail, author.email);
  assert.equal(adminEdit.ownerEmail, author.email);
  await assert.rejects(store.saveDraft({ title: 'Unsafe image', description: 'Invalid image input', imageUrl: 'javascript:alert(1)' }, author), /https image URL/);
  assert.equal((await store.listPublished()).length, 1);
  assert.equal(await store.submitForReview(draft.id, author), null);
  assert.equal((await store.setStatus(draft.id, 'archived')).status, 'archived');
  assert.equal((await store.setStatus(draft.id, 'published')).status, 'published');
  assert.equal(await store.deleteById(draft.id), true);
  assert.equal(await store.deleteById(draft.id), false);
  assert.equal(admin.role, 'admin');
});

test('migrates legacy ownership and lets admin manage stories without changing bylines', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-editorial-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, 'articles.json');
  await writeFile(filePath, JSON.stringify([{
    id: 'legacy-story',
    title: 'Legacy story',
    description: 'Existing editorial coverage.',
    status: 'published',
    author_email: 'AzTech Africa Editorial Team',
    content: [{ type: 'paragraph', text: 'Original story copy.' }],
  }]));

  const store = createEditorialStore(null, [{ id: 'legacy-story', category: 'roundup', label: 'Editorial', title: 'Seed title', cardTitle: 'Seed title', description: 'Seed summary', content: [], countries: [], topics: [] }], { filePath });
  await store.initialize();
  const admin = { email: 'makayaemmanuel42@gmail.com', role: 'admin' };
  const author = { email: 'writer@example.test', role: 'author' };
  const legacy = await store.getById('legacy-story');
  assert.equal(legacy.ownerEmail, admin.email);
  assert.equal(legacy.authorEmail, 'AzTech Africa Editorial Team');
  await assert.rejects(store.saveDraft({ ...legacy }, author), /only edit your own/);

  const updated = await store.saveDraft({ ...legacy, title: 'Legacy story updated', description: 'Updated editorial coverage.' }, admin);
  assert.equal(updated.title, 'Legacy story updated');
  assert.equal(updated.status, 'published');
  assert.equal(updated.authorEmail, 'AzTech Africa Editorial Team');
  assert.equal((await store.setStatus('legacy-story', 'archived')).status, 'archived');
  await store.initialize();
  assert.equal((await store.getById('legacy-story')).status, 'archived');
  assert.equal((await store.setStatus('legacy-story', 'published')).status, 'published');
  assert.equal(await store.deleteById('legacy-story'), true);
  assert.equal(await store.getById('legacy-story'), null);

  const persisted = JSON.parse(await readFile(filePath, 'utf8'));
  assert.deepEqual(persisted, []);
});

test('migrates Postgres legacy owners to Makaya without changing seed bylines', async () => {
  const calls = [];
  const pool = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      return { rows: [], rowCount: 0 };
    },
  };
  const store = createEditorialStore(pool, [{
    id: 'legacy-seed',
    category: 'roundup',
    label: 'Editorial',
    tag: 'Weekly roundup',
    readTime: '4 min read',
    title: 'Existing issue',
    cardTitle: 'Existing issue',
    description: 'Existing coverage.',
    date: 'Issue 1',
    content: [],
    countries: [],
    topics: [],
  }]);
  await store.initialize();

  const ownershipMigration = calls.find((call) => call.sql.includes('UPDATE editorial_articles SET owner_email'));
  const seedInsert = calls.find((call) => call.sql.includes('INSERT INTO editorial_articles'));
  assert.deepEqual(ownershipMigration.values, ['makayaemmanuel42@gmail.com']);
  assert.match(seedInsert.sql, /'AzTech Africa Editorial Team'/);
  assert.equal(seedInsert.values[14], 'makayaemmanuel42@gmail.com');
});
