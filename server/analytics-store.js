import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Pool } from 'pg';

const allowedTypes = new Set(['page_view', 'story_view', 'story_complete', 'click']);

export class AnalyticsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnalyticsValidationError';
    this.statusCode = 400;
  }
}

function safeText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function normalizePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    throw new AnalyticsValidationError('Choose a valid analytics page path.');
  }
  try {
    return new URL(value, 'https://analytics.invalid').pathname.slice(0, 300) || '/';
  } catch {
    throw new AnalyticsValidationError('Choose a valid analytics page path.');
  }
}

function normalizeDestination(value) {
  const destination = safeText(value, 500);
  if (!destination) return '';
  try {
    const url = new URL(destination, 'https://analytics.invalid');
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const host = url.origin === 'https://analytics.invalid' ? '' : url.origin;
    return `${host}${url.pathname}`.slice(0, 300);
  } catch {
    return '';
  }
}

function normalizeEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !allowedTypes.has(body.type)) {
    throw new AnalyticsValidationError('Choose a supported analytics event.');
  }
  const contentId = safeText(body.contentId, 160);
  if (['story_view', 'story_complete'].includes(body.type) && !contentId) {
    throw new AnalyticsValidationError('Story reading events need a story ID.');
  }
  return {
    id: randomUUID(),
    type: body.type,
    path: normalizePath(body.path),
    contentId: contentId || null,
    label: safeText(body.label, 120),
    destination: normalizeDestination(body.destination),
    createdAt: new Date().toISOString(),
  };
}

function clampDays(value) {
  return Math.min(365, Math.max(1, Math.floor(Number(value) || 30)));
}

function emptySummary(days) {
  const today = new Date();
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days + index + 1));
    return { date: date.toISOString().slice(0, 10), pageViews: 0, storyViews: 0, completedReads: 0, clicks: 0 };
  });
  return { days, totals: { pageViews: 0, storyViews: 0, completedReads: 0, clicks: 0 }, series, topArticles: [], topClicks: [] };
}

function summarizeEvents(events, days) {
  const summary = emptySummary(days);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const dates = new Map(summary.series.map((item) => [item.date, item]));
  const articles = new Map();
  const clicks = new Map();

  for (const event of events) {
    const createdAt = new Date(event.createdAt);
    if (Number.isNaN(createdAt.getTime()) || createdAt.getTime() < cutoff) continue;
    const date = createdAt.toISOString().slice(0, 10);
    const daily = dates.get(date);
    if (event.type === 'page_view') summary.totals.pageViews += 1;
    if (event.type === 'story_view') {
      summary.totals.storyViews += 1;
      const item = articles.get(event.contentId) || { contentId: event.contentId, views: 0, completedReads: 0 };
      item.views += 1;
      articles.set(event.contentId, item);
    }
    if (event.type === 'story_complete') {
      summary.totals.completedReads += 1;
      const item = articles.get(event.contentId) || { contentId: event.contentId, views: 0, completedReads: 0 };
      item.completedReads += 1;
      articles.set(event.contentId, item);
    }
    if (event.type === 'click') {
      summary.totals.clicks += 1;
      const key = JSON.stringify([event.label, event.destination]);
      const item = clicks.get(key) || { label: event.label || 'Unlabelled control', destination: event.destination, clicks: 0 };
      item.clicks += 1;
      clicks.set(key, item);
    }
    if (daily) {
      if (event.type === 'page_view') daily.pageViews += 1;
      if (event.type === 'story_view') daily.storyViews += 1;
      if (event.type === 'story_complete') daily.completedReads += 1;
      if (event.type === 'click') daily.clicks += 1;
    }
  }

  summary.topArticles = [...articles.values()].sort((left, right) => right.views - left.views).slice(0, 10);
  summary.topClicks = [...clicks.values()].sort((left, right) => right.clicks - left.clicks).slice(0, 10);
  return summary;
}

export function createAnalyticsStore(providedPool, { filePath } = {}) {
  const pool = providedPool || (process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 10_000 }) : null);
  let localEvents = [];
  let writeQueue = Promise.resolve();

  async function loadLocalEvents() {
    if (!filePath) return [];
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async function saveLocalEvents() {
    if (!filePath) return;
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(localEvents, null, 2));
  }

  return {
    async initialize() {
      if (pool) {
        await pool.query(`CREATE TABLE IF NOT EXISTS site_analytics_events (
          id UUID PRIMARY KEY,
          event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'story_view', 'story_complete', 'click')),
          page_path TEXT NOT NULL,
          content_id TEXT,
          label TEXT NOT NULL DEFAULT '',
          destination TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        await pool.query('CREATE INDEX IF NOT EXISTS site_analytics_events_created_at_idx ON site_analytics_events (created_at)');
        await pool.query('CREATE INDEX IF NOT EXISTS site_analytics_events_content_id_idx ON site_analytics_events (content_id, event_type)');
      } else {
        localEvents = await loadLocalEvents();
      }
    },
    async record(body) {
      const event = normalizeEvent(body);
      if (pool) {
        await pool.query(
          `INSERT INTO site_analytics_events (id, event_type, page_path, content_id, label, destination, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [event.id, event.type, event.path, event.contentId, event.label, event.destination, event.createdAt],
        );
      } else {
        const write = writeQueue.then(async () => {
          localEvents.push(event);
          await saveLocalEvents();
        });
        writeQueue = write.catch(() => {});
        await write;
      }
      return { accepted: true };
    },
    async summary(options = {}) {
      const days = clampDays(options.days);
      if (!pool) return summarizeEvents(localEvents, days);

      const [totalsResult, seriesResult, articlesResult, clicksResult] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS "pageViews",
                  COUNT(*) FILTER (WHERE event_type = 'story_view')::int AS "storyViews",
                  COUNT(*) FILTER (WHERE event_type = 'story_complete')::int AS "completedReads",
                  COUNT(*) FILTER (WHERE event_type = 'click')::int AS "clicks"
           FROM site_analytics_events WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')`, [days],
        ),
        pool.query(
          `SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
                  COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS "pageViews",
                  COUNT(*) FILTER (WHERE event_type = 'story_view')::int AS "storyViews",
                  COUNT(*) FILTER (WHERE event_type = 'story_complete')::int AS "completedReads",
                  COUNT(*) FILTER (WHERE event_type = 'click')::int AS clicks
           FROM site_analytics_events WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
           GROUP BY date ORDER BY date`, [days],
        ),
        pool.query(
          `SELECT content_id AS "contentId",
                  COUNT(*) FILTER (WHERE event_type = 'story_view')::int AS views,
                  COUNT(*) FILTER (WHERE event_type = 'story_complete')::int AS "completedReads"
           FROM site_analytics_events WHERE content_id IS NOT NULL AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
           GROUP BY content_id ORDER BY views DESC LIMIT 10`, [days],
        ),
        pool.query(
          `SELECT label, destination, COUNT(*)::int AS clicks
           FROM site_analytics_events WHERE event_type = 'click' AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
           GROUP BY label, destination ORDER BY clicks DESC LIMIT 10`, [days],
        ),
      ]);
      const summary = emptySummary(days);
      const totals = totalsResult.rows[0] || {};
      summary.totals = {
        pageViews: totals.pageViews || 0,
        storyViews: totals.storyViews || 0,
        completedReads: totals.completedReads || 0,
        clicks: totals.clicks || 0,
      };
      const daily = new Map(summary.series.map((item) => [item.date, item]));
      for (const row of seriesResult.rows) if (daily.has(row.date)) Object.assign(daily.get(row.date), row);
      summary.topArticles = articlesResult.rows;
      summary.topClicks = clicksResult.rows;
      return summary;
    },
  };
}