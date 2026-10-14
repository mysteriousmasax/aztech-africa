import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { AnalyticsValidationError, createAnalyticsStore } from '../server/analytics-store.js';

test('stores anonymous reader events and summarizes views, completed reads, and clicks', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-analytics-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, 'events.json');
  const store = createAnalyticsStore(null, { filePath });
  await store.initialize();

  await store.record({ type: 'page_view', path: '/' });
  await store.record({ type: 'story_view', path: '/story', contentId: 'story-1' });
  await store.record({ type: 'story_complete', path: '/story', contentId: 'story-1' });
  await store.record({ type: 'click', path: '/story?email=private@example.test', contentId: 'story-1', label: 'Read the source', destination: 'https://source.example.test/report?token=secret#summary' });

  const summary = await store.summary({ days: 30 });
  assert.deepEqual(summary.totals, { pageViews: 1, storyViews: 1, completedReads: 1, clicks: 1 });
  assert.deepEqual(summary.topArticles, [{ contentId: 'story-1', views: 1, completedReads: 1 }]);
  assert.deepEqual(summary.topClicks, [{ label: 'Read the source', destination: 'https://source.example.test/report', clicks: 1 }]);

  const savedEvents = JSON.parse(await readFile(filePath, 'utf8'));
  assert.equal(savedEvents[3].path, '/story');
  assert.equal(savedEvents[3].destination, 'https://source.example.test/report');
  assert.equal(Object.hasOwn(savedEvents[3], 'email'), false);
});

test('rejects unsupported analytics events and bounds summary windows', async () => {
  const store = createAnalyticsStore(null);
  await store.initialize();
  await assert.rejects(store.record({ type: 'identify', path: '/' }), AnalyticsValidationError);
  await assert.rejects(store.record({ type: 'click', path: '//attacker.example/path' }), AnalyticsValidationError);
  await assert.rejects(store.record({ type: 'story_view', path: '/story' }), AnalyticsValidationError);
  const summary = await store.summary({ days: 9999 });
  assert.equal(summary.days, 365);
  assert.equal(summary.series.length, 365);
});

test('initializes the Postgres event table and maps aggregate reports', async () => {
  const statements = [];
  const insertedEvents = [];
  const today = new Date().toISOString().slice(0, 10);
  const pool = {
    async query(sql, params = []) {
      statements.push(sql);
      if (sql.includes('INSERT INTO site_analytics_events')) {
        insertedEvents.push(params);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('SELECT COUNT(*) FILTER')) return { rows: [{ pageViews: 8, storyViews: 4, completedReads: 2, clicks: 6 }] };
      if (sql.includes('TO_CHAR(created_at')) return { rows: [{ date: today, pageViews: 2, storyViews: 1, completedReads: 1, clicks: 3 }] };
      if (sql.includes('SELECT content_id')) return { rows: [{ contentId: 'story-1', views: 4, completedReads: 2 }] };
      if (sql.includes('SELECT label, destination')) return { rows: [{ label: 'Read report', destination: '/reports', clicks: 3 }] };
      return { rows: [], rowCount: 0 };
    },
  };
  const store = createAnalyticsStore(pool);
  await store.initialize();
  await store.record({ type: 'click', path: '/reports?source=private', label: 'Read report', destination: 'https://example.test/reports?id=private' });
  const summary = await store.summary({ days: 30 });

  assert.equal(statements.filter((sql) => sql.includes('CREATE TABLE')).length, 1);
  assert.equal(insertedEvents[0][2], '/reports');
  assert.equal(insertedEvents[0][5], 'https://example.test/reports');
  assert.deepEqual(summary.totals, { pageViews: 8, storyViews: 4, completedReads: 2, clicks: 6 });
  assert.deepEqual(summary.topArticles, [{ contentId: 'story-1', views: 4, completedReads: 2 }]);
  assert.equal(summary.series.at(-1).date, today);
  assert.deepEqual(summary.topClicks, [{ label: 'Read report', destination: '/reports', clicks: 3 }]);
});