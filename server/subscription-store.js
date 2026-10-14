import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Pool } from 'pg';

export class SubscriptionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SubscriptionValidationError';
    this.statusCode = 400;
  }
}

const supportedCountries = new Set(['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Burundi', 'South Sudan', 'DR Congo']);
const supportedInterests = new Set(['fintech', 'agritech', 'climate', 'ai', 'policy', 'funding', 'opportunities', 'events']);

function normalizeReaderPreferences(body) {
  if (body.swahiliSummary !== undefined && typeof body.swahiliSummary !== 'boolean') {
    throw new SubscriptionValidationError('Choose whether you want the Swahili summary.');
  }
  const country = body.country === undefined ? 'Tanzania' : body.country;
  const interests = body.interests === undefined ? [] : body.interests;
  if (!supportedCountries.has(country)) throw new SubscriptionValidationError('Choose a supported country preference.');
  if (!Array.isArray(interests) || interests.length > supportedInterests.size || interests.some((interest) => !supportedInterests.has(interest))) {
    throw new SubscriptionValidationError('Choose valid newsletter interests.');
  }
  return { swahiliSummary: body.swahiliSummary === true, country, interests: [...new Set(interests)] };
}

export function validateSubscription(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SubscriptionValidationError('Enter a valid email address.');
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SubscriptionValidationError('Enter a valid email address.');
  }
  if (body.consent !== true) {
    throw new SubscriptionValidationError('Please agree to receive the newsletter before subscribing.');
  }
  return {
    email,
    ...normalizeReaderPreferences(body),
    source: body.source === 'hero' ? 'hero' : 'newsletter',
  };
}

export function createSubscriptionStore({ databaseUrl = process.env.DATABASE_URL, filePath, pool: providedPool, sendVerification = async () => false } = {}) {
  const pool = providedPool || (databaseUrl ? new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 10_000 }) : null);
  let writeQueue = Promise.resolve();

  async function subscribeToDatabase(subscription) {
    const verificationToken = randomBytes(32).toString('base64url');
    const manageToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const inserted = await pool.query(
      `INSERT INTO newsletter_subscribers (id, email, swahili_summary, country, interests, source, status, consented_at, subscribed_at, verification_token_hash, manage_token_hash, token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW(), $7, $8, $9)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [randomUUID(), subscription.email, subscription.swahiliSummary, subscription.country, subscription.interests, subscription.source, hashToken(verificationToken), hashToken(manageToken), expiresAt],
    );
    const isNew = inserted.rowCount > 0;
    let preferencesUpdated = false;
    if (!isNew) {
      const refreshed = await pool.query(
        `UPDATE newsletter_subscribers
         SET swahili_summary = $2, country = $3, interests = $4, source = $5, verification_token_hash = $6, manage_token_hash = $7, token_expires_at = $8
         WHERE email = $1 AND status = 'pending'
         RETURNING id`,
        [subscription.email, subscription.swahiliSummary, subscription.country, subscription.interests, subscription.source, hashToken(verificationToken), hashToken(manageToken), expiresAt],
      );
      if (refreshed.rowCount === 0) {
        const existing = await pool.query('SELECT status, swahili_summary FROM newsletter_subscribers WHERE email = $1', [subscription.email]);
        const status = existing.rows[0]?.status;
        if (status === 'active') {
          const updated = await pool.query(
            `UPDATE newsletter_subscribers SET swahili_summary = $2, country = $3, interests = $4, source = $5, updated_at = NOW()
             WHERE email = $1 AND (swahili_summary IS DISTINCT FROM $2 OR country IS DISTINCT FROM $3 OR interests IS DISTINCT FROM $4)`,
            [subscription.email, subscription.swahiliSummary, subscription.country, subscription.interests, subscription.source],
          );
          return { alreadySubscribed: true, preferencesUpdated: updated.rowCount > 0, pending: false, emailSent: false };
        }
        if (status === 'unsubscribed') {
          await pool.query(
            `UPDATE newsletter_subscribers SET status = 'pending', swahili_summary = $2, country = $3, interests = $4, source = $5,
             consented_at = NOW(), verification_token_hash = $6, manage_token_hash = $7, token_expires_at = $8, unsubscribed_at = NULL
             WHERE email = $1`,
            [subscription.email, subscription.swahiliSummary, subscription.country, subscription.interests, subscription.source, hashToken(verificationToken), hashToken(manageToken), expiresAt],
          );
        }
      } else {
        preferencesUpdated = true;
      }
    }

    let emailSent = false;
    try {
      emailSent = await sendVerification({ email: subscription.email, verificationToken, manageToken });
    } catch {
      emailSent = false;
    }
    return { alreadySubscribed: !isNew, preferencesUpdated, pending: true, emailSent };
  }

  function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
  }

  async function readSubscribers() {
    try {
      const data = JSON.parse(await readFile(filePath, 'utf8'));
      const subscribers = Array.isArray(data) ? data : data?.value;
      if (!Array.isArray(subscribers)) throw new Error('Subscriber data must be a JSON array.');
      return subscribers;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  return {
    async initialize() {
      if (!pool) return;
      await pool.query(`
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
          id UUID PRIMARY KEY,
          email VARCHAR(254) NOT NULL UNIQUE,
          swahili_summary BOOLEAN NOT NULL DEFAULT FALSE,
          country TEXT NOT NULL DEFAULT 'Tanzania',
          interests TEXT[] NOT NULL DEFAULT '{}',
          source VARCHAR(32) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          consented_at TIMESTAMPTZ NOT NULL,
          subscribed_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ,
          verification_token_hash TEXT,
          manage_token_hash TEXT,
          token_expires_at TIMESTAMPTZ,
          verified_at TIMESTAMPTZ,
          welcome_sent_at TIMESTAMPTZ,
          unsubscribed_at TIMESTAMPTZ
        )
      `);
      await pool.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS verification_token_hash TEXT');
      await pool.query("ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Tanzania'");
      await pool.query("ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS interests TEXT[] NOT NULL DEFAULT '{}'");
      await pool.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS manage_token_hash TEXT');
      await pool.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ');
      await pool.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ');
      await pool.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ');
      await pool.query('ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ');
    },
    async subscribe(body) {
      const subscription = validateSubscription(body);
      if (pool) return subscribeToDatabase(subscription);
      if (!filePath) throw new Error('Set DATABASE_URL or configure a local subscriber file.');
      const operation = writeQueue.then(async () => {
        const subscribers = await readSubscribers();
        const existingIndex = subscribers.findIndex((item) => item.email === subscription.email);
        const now = new Date().toISOString();

        if (existingIndex !== -1) {
          const existing = subscribers[existingIndex];
          const preferencesChanged = existing.swahiliSummary !== subscription.swahiliSummary || (existing.country || 'Tanzania') !== subscription.country || JSON.stringify(existing.interests || []) !== JSON.stringify(subscription.interests);
          if (preferencesChanged) {
            subscribers[existingIndex] = {
              ...existing,
              swahiliSummary: subscription.swahiliSummary,
              country: subscription.country,
              interests: subscription.interests,
              source: subscription.source,
              updatedAt: now,
            };
            await saveSubscribers(subscribers);
          }
          return { alreadySubscribed: true, preferencesUpdated: preferencesChanged };
        }

        subscribers.push({
          id: randomUUID(),
          email: subscription.email,
          swahiliSummary: subscription.swahiliSummary,
          country: subscription.country,
          interests: subscription.interests,
          source: subscription.source,
          status: 'active',
          consentedAt: now,
          subscribedAt: now,
        });
        await saveSubscribers(subscribers);
        return { alreadySubscribed: false, preferencesUpdated: false };
      });

      writeQueue = operation.then(() => undefined, () => undefined);
      return operation;
    },
    async verifySubscriber(token) {
      if (!pool || typeof token !== 'string' || token.length > 128) return false;
      const result = await pool.query(
        `UPDATE newsletter_subscribers SET status = 'active', verified_at = NOW(), verification_token_hash = NULL, token_expires_at = NULL
         WHERE verification_token_hash = $1 AND status = 'pending' AND token_expires_at > NOW()
         RETURNING id,email,swahili_summary,country,interests`,
        [hashToken(token)],
      );
      return result.rows[0] || null;
    },
    async verify(token) {
      return Boolean(await this.verifySubscriber(token));
    },
    async recordWelcomeSent(email) {
      if (!pool || typeof email !== 'string') return false;
      const result = await pool.query("UPDATE newsletter_subscribers SET welcome_sent_at=NOW() WHERE email=$1 AND status='active' AND welcome_sent_at IS NULL RETURNING id", [email.trim().toLowerCase()]);
      return result.rowCount > 0;
    },
    async manage(token) {
      if (!pool || typeof token !== 'string' || token.length > 128) return null;
      const { rows } = await pool.query(
        `SELECT email, swahili_summary, country, interests, status FROM newsletter_subscribers
         WHERE manage_token_hash = $1 AND status IN ('active', 'pending')`,
        [hashToken(token)],
      );
      return rows[0] || null;
    },
    async updatePreferences(token, preferences) {
      if (!pool || typeof token !== 'string' || token.length > 128) return false;
      const normalized = normalizeReaderPreferences(preferences || {});
      const result = await pool.query(
        `UPDATE newsletter_subscribers SET swahili_summary = $2, country = $3, interests = $4, updated_at = NOW()
         WHERE manage_token_hash = $1 AND status = 'active' RETURNING id`,
        [hashToken(token), normalized.swahiliSummary, normalized.country, normalized.interests],
      );
      return result.rowCount > 0;
    },
    async unsubscribe(token) {
      if (!pool || typeof token !== 'string' || token.length > 128) return false;
      const result = await pool.query(
        `UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = NOW(), verification_token_hash = NULL
         WHERE manage_token_hash = $1 AND status IN ('active', 'pending') RETURNING id`,
        [hashToken(token)],
      );
      return result.rowCount > 0;
    },
    async stats() {
      if (pool) {
        const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM newsletter_subscribers WHERE status = 'active'");
        return { confirmedSubscribers: rows[0].count };
      }
      if (!filePath) return { confirmedSubscribers: 0 };
      const subscribers = await readSubscribers();
      return { confirmedSubscribers: subscribers.filter((subscriber) => subscriber.status === 'active').length };
    },
    async crm({ search = '', status = 'all', page = 1, perPage = 50 } = {}) {
      const normalizedStatus = ['all', 'pending', 'active', 'unsubscribed'].includes(status) ? status : 'all';
      const normalizedSearch = typeof search === 'string' ? search.trim().slice(0, 200).toLowerCase() : '';
      const currentPage = Math.max(1, Math.floor(Number(page) || 1));
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(perPage) || 50)));
      if (pool) {
        const countsResult = await pool.query('SELECT status,COUNT(*)::int AS count FROM newsletter_subscribers GROUP BY status');
        const counts = { pending: 0, active: 0, unsubscribed: 0 };
        for (const row of countsResult.rows) if (Object.hasOwn(counts, row.status)) counts[row.status] = row.count;
        const values = [];
        const conditions = [];
        if (normalizedStatus !== 'all') {
          values.push(normalizedStatus);
          conditions.push(`status=$${values.length}`);
        }
        if (normalizedSearch) {
          values.push(`%${normalizedSearch}%`);
          conditions.push(`(email ILIKE $${values.length} OR country ILIKE $${values.length} OR source ILIKE $${values.length})`);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const totalResult = await pool.query(`SELECT COUNT(*)::int AS count FROM newsletter_subscribers ${where}`, values);
        const rowValues = [...values, pageSize, (currentPage - 1) * pageSize];
        const contactsResult = await pool.query(
          `SELECT id,email,status,country,interests,source,swahili_summary AS "swahiliSummary",consented_at AS "consentedAt",subscribed_at AS "subscribedAt",verified_at AS "verifiedAt",welcome_sent_at AS "welcomeSentAt",unsubscribed_at AS "unsubscribedAt"
           FROM newsletter_subscribers ${where} ORDER BY subscribed_at DESC LIMIT $${rowValues.length - 1} OFFSET $${rowValues.length}`,
          rowValues,
        );
        return { page: currentPage, perPage: pageSize, total: totalResult.rows[0]?.count || 0, counts, contacts: contactsResult.rows };
      }
      if (!filePath) return { page: currentPage, perPage: pageSize, total: 0, counts: { pending: 0, active: 0, unsubscribed: 0 }, contacts: [] };
      const allContacts = await readSubscribers();
      const counts = { pending: 0, active: 0, unsubscribed: 0 };
      for (const contact of allContacts) if (Object.hasOwn(counts, contact.status)) counts[contact.status] += 1;
      const filtered = allContacts.filter((contact) => {
        if (normalizedStatus !== 'all' && contact.status !== normalizedStatus) return false;
        return !normalizedSearch || [contact.email, contact.country, contact.source].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
      }).sort((left, right) => new Date(right.subscribedAt || right.subscribed_at || 0) - new Date(left.subscribedAt || left.subscribed_at || 0));
      const contacts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((contact) => ({
        id: contact.id || contact.email,
        email: contact.email,
        status: contact.status,
        country: contact.country || 'Tanzania',
        interests: contact.interests || [],
        source: contact.source || '',
        swahiliSummary: Boolean(contact.swahiliSummary),
        consentedAt: contact.consentedAt || contact.consented_at || null,
        subscribedAt: contact.subscribedAt || contact.subscribed_at || null,
        verifiedAt: contact.verifiedAt || contact.verified_at || null,
        welcomeSentAt: contact.welcomeSentAt || contact.welcome_sent_at || null,
        unsubscribedAt: contact.unsubscribedAt || contact.unsubscribed_at || null,
      }));
      return { page: currentPage, perPage: pageSize, total: filtered.length, counts, contacts };
    },
    async audience() {
      const eligibleStatuses = new Set(['active', 'unsubscribed']);
      if (pool) {
        const { rows } = await pool.query("SELECT email,status,country,interests,swahili_summary FROM newsletter_subscribers WHERE status IN ('active','unsubscribed') ORDER BY email");
        return rows.map((subscriber) => ({
          email: subscriber.email,
          status: subscriber.status,
          country: subscriber.country,
          interests: subscriber.interests || [],
          swahiliSummary: subscriber.swahili_summary,
        }));
      }
      if (!filePath) return [];
      return (await readSubscribers())
        .filter((subscriber) => eligibleStatuses.has(subscriber.status))
        .map((subscriber) => ({
          email: subscriber.email,
          status: subscriber.status,
          country: subscriber.country || 'Tanzania',
          interests: subscriber.interests || [],
          swahiliSummary: Boolean(subscriber.swahiliSummary),
        }));
    },
  };

  async function saveSubscribers(subscribers) {
    await mkdir(dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(subscribers, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, filePath);
  }
}
