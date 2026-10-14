import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSiteSettingsStore, defaultSiteSettings } from '../server/site-settings-store.js';

test('site and footer settings are public-readable, editable, and validate destinations', async () => {
  const values = new Map();
  const pool = {
    async query(sql, params = []) {
      if (sql.includes('CREATE TABLE')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO site_settings')) {
        if (sql.includes('DO NOTHING') && values.has(params[0])) return { rows: [], rowCount: 0 };
        values.set(params[0], JSON.parse(params[1]));
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('SELECT key,value')) return { rows: [...values].map(([key, value]) => ({ key, value })), rowCount: values.size };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const store = createSiteSettingsStore(pool);
  await store.initialize();
  assert.deepEqual(await store.get(), defaultSiteSettings);
  const updated = await store.update({
    heroImageUrl: 'https://images.example.test/hero.jpg',
    heroImageAlt: 'Dar es Salaam skyline',
    socialXUrl: 'https://x.com/aztechafrica',
    rssFeedUrl: '/api/feed.xml',
    contactEmail: 'editor@example.test',
    footerAboutText: 'Independent reporting across East Africa.',
    footerCoverageHeading: 'Explore coverage',
    footerCoverageLinks: [{ label: 'Startup finance', topic: 'investing' }],
    saharaVenturesLabel: 'Sahara Ventures Network',
    welcomeEmailEnabled: false,
    welcomeEmailSubject: 'Welcome, reader',
    welcomeEmailBody: 'Thanks for confirming your subscription.',
    newsletterAds: [{
      title: 'Founder programme applications are open',
      sponsor: 'Regional Innovation Fund',
      description: 'Apply for a founder grant before 30 June.',
      imageUrl: 'https://images.example.test/sponsor.jpg',
      imageAlt: 'Regional Innovation Fund founder programme',
      clickUrl: 'https://fund.example.test/apply',
      active: true,
    }],
  });
  assert.equal(updated.heroImageUrl, 'https://images.example.test/hero.jpg');
  assert.equal(updated.socialXUrl, 'https://x.com/aztechafrica');
  assert.equal(updated.rssFeedUrl, '/api/feed.xml');
  assert.equal(updated.contactEmail, 'editor@example.test');
  assert.equal(updated.footerAboutText, 'Independent reporting across East Africa.');
  assert.equal(updated.footerCoverageHeading, 'Explore coverage');
  assert.deepEqual(updated.footerCoverageLinks, [{ label: 'Startup finance', topic: 'investing' }]);
  assert.equal(updated.saharaVenturesLabel, 'Sahara Ventures Network');
  assert.equal(updated.welcomeEmailEnabled, false);
  assert.equal(updated.welcomeEmailSubject, 'Welcome, reader');
  assert.equal(updated.welcomeEmailBody, 'Thanks for confirming your subscription.');
  assert.equal(updated.newsletterAds[0].sponsor, 'Regional Innovation Fund');
  assert.equal(updated.newsletterAds[0].active, true);
  await assert.rejects(store.update({ heroImageUrl: 'javascript:alert(1)', heroImageAlt: 'unsafe' }), /https image URL/);
  await assert.rejects(store.update({ contactEmail: 'not-an-email' }), /valid contact email/);
  await assert.rejects(store.update({ socialXUrl: 'javascript:alert(1)' }), /https URL/);
  await assert.rejects(store.update({ footerCoverageLinks: [{ label: 'Bad topic', topic: 'news && <script>' }] }), /lowercase topic key/);
  await assert.rejects(store.update({ footerAboutText: 'x'.repeat(601) }), /no longer than 600 characters/);
  await assert.rejects(store.update({ newsletterAds: [{ active: true, imageUrl: 'javascript:alert(1)' }] }), /Sponsored cards need valid/);
  await assert.rejects(store.update({ welcomeEmailEnabled: 'yes' }), /true or false/);
});

test('persists editable footer content in local fallback mode', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-site-settings-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const store = createSiteSettingsStore(null, { filePath: join(directory, 'settings.json') });
  await store.initialize();
  const updated = await store.update({
    footerAboutText: 'Independent reporting across East Africa.',
    footerCoverageLinks: [{ label: 'Startup finance', topic: 'investing' }],
  });

  assert.equal(updated.footerAboutText, 'Independent reporting across East Africa.');
  assert.deepEqual(updated.footerCoverageLinks, [{ label: 'Startup finance', topic: 'investing' }]);
  assert.deepEqual(await store.get(), updated);
});