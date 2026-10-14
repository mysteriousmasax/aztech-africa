import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const localSettingsPath = fileURLToPath(new URL('./data/site-settings.json', import.meta.url));

async function readLocalSettings(filePath = localSettingsPath) {
  try {
    const text = await readFile(filePath, 'utf8');
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeLocalSettings(settings, filePath = localSettingsPath) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(settings, null, 2));
}

export const defaultSiteSettings = {
  heroImageUrl: '/dar-es-salaam-hero.png',
  heroImageAlt: 'Concept art of a digitally connected Dar es Salaam skyline and East African coast at sunset',
  socialXUrl: 'https://x.com',
  socialLinkedInUrl: 'https://linkedin.com',
  rssFeedUrl: '/api/feed.xml',
  saharaVenturesUrl: '#partners',
  sbanUrl: '#partners',
  ictCommissionUrl: '#partners',
  dealSheetUrl: '#archive-section',
  contactEmail: '',
  privacyPolicyUrl: '',
  editorialEthicsUrl: '',
  footerAboutText: 'The authoritative intelligence digest documenting the innovators, capital flows, and policy makers of Silicon Dar and East Africa.',
  footerLocationText: 'Dar es Salaam, Tanzania • Nairobi • Kigali',
  footerCopyrightText: '© 2024 AzTech Africa. All rights reserved. Registered tech publication in Tanzania.',
  footerCoverageHeading: 'Coverage',
  footerCoverageLinks: [
    { label: 'Weekly Roundups', topic: 'roundup' },
    { label: 'Fintech Sandboxes', topic: 'fintech' },
    { label: 'AgriTech & Blue Economy', topic: 'agritech' },
    { label: 'Founder Interviews', topic: 'community' },
    { label: 'Cross-Border Policy', topic: 'policy' },
  ],
  footerEcosystemHeading: 'Ecosystem Links',
  saharaVenturesLabel: 'Sahara Ventures',
  sbanLabel: 'Tanzania Angel Investors (S-BAN)',
  ictCommissionLabel: 'ICT Commission Portal',
  dealSheetLabel: 'Deal Sheet Archive',
  footerRssLabel: 'RSS Feed',
  footerAdvertiseLabel: 'Advertise / Partner',
  footerCommunityHeading: 'Language & Community',
  footerCommunityText: 'Jarida hili linapatikana pia kwa lugha ya Kiswahili kwa wanajumuiya wetu wote.',
  privacyPolicyLabel: 'Privacy Policy',
  editorialEthicsLabel: 'Editorial Ethics',
  contactDeskLabel: 'Contact Desk',
  newsletterAds: [],
  welcomeEmailEnabled: true,
  welcomeEmailSubject: 'Welcome to AzTech Africa',
  welcomeEmailBody: 'Thanks for confirming your subscription. You are now on the list for our weekly East Africa technology brief.\n\nYou can update your preferences or unsubscribe using the link in each newsletter.',
};

const footerTextLimits = {
  footerAboutText: 600,
  footerLocationText: 200,
  footerCopyrightText: 300,
  footerCoverageHeading: 80,
  footerEcosystemHeading: 80,
  saharaVenturesLabel: 100,
  sbanLabel: 100,
  ictCommissionLabel: 100,
  dealSheetLabel: 100,
  footerRssLabel: 60,
  footerAdvertiseLabel: 80,
  footerCommunityHeading: 80,
  footerCommunityText: 300,
  privacyPolicyLabel: 80,
  editorialEthicsLabel: 80,
  contactDeskLabel: 80,
  welcomeEmailSubject: 160,
  welcomeEmailBody: 3000,
};

function normalizeFooterCoverageLinks(value) {
  if (!Array.isArray(value) || value.length > 8) return null;
  const links = value.map((link) => ({
    label: typeof link?.label === 'string' ? link.label.trim().slice(0, 100) : '',
    topic: typeof link?.topic === 'string' ? link.topic.trim().toLowerCase().slice(0, 80) : '',
  }));
  if (links.some((link) => !link.label || (link.topic && !/^[a-z0-9-]+$/.test(link.topic)))) return null;
  return links;
}

function validImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('..')) return true;
  try { return new URL(value).protocol === 'https:'; }
  catch { return false; }
}

function validFooterUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('..')) return true;
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; }
  catch { return false; }
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && (!value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function normalizeNewsletterAds(value) {
  if (!Array.isArray(value) || value.length > 3) return null;
  const ads = value.map((ad) => ({
    title: typeof ad?.title === 'string' ? ad.title.trim().slice(0, 120) : '',
    sponsor: typeof ad?.sponsor === 'string' ? ad.sponsor.trim().slice(0, 120) : '',
    description: typeof ad?.description === 'string' ? ad.description.trim().slice(0, 400) : '',
    imageUrl: typeof ad?.imageUrl === 'string' ? ad.imageUrl.trim() : '',
    imageAlt: typeof ad?.imageAlt === 'string' ? ad.imageAlt.trim().slice(0, 300) : '',
    clickUrl: typeof ad?.clickUrl === 'string' ? ad.clickUrl.trim() : '',
    active: ad?.active === true,
  }));
  if (ads.some((ad) => ad.imageUrl && !validImageUrl(ad.imageUrl))) return null;
  if (ads.some((ad) => ad.clickUrl && !validFooterUrl(ad.clickUrl))) return null;
  if (ads.some((ad) => ad.active && (!ad.title || !ad.sponsor || !ad.description || !ad.imageUrl || !ad.imageAlt || !ad.clickUrl))) return null;
  return ads;
}

export function createSiteSettingsStore(pool, { filePath = localSettingsPath } = {}) {
  if (!pool) {
    const readSettings = () => readLocalSettings(filePath);
    const writeSettings = (settings) => writeLocalSettings(settings, filePath);
    return {
      async initialize() {
        const current = await readSettings();
        await writeSettings({ ...defaultSiteSettings, ...current });
      },
      async get() {
        const current = await readSettings();
        return { ...defaultSiteSettings, ...current };
      },
      async update(input) {
        const current = await this.get();
        const heroImageUrl = typeof input.heroImageUrl === 'string' ? input.heroImageUrl.trim() : current.heroImageUrl;
        const heroImageAlt = typeof input.heroImageAlt === 'string' ? input.heroImageAlt.trim().slice(0, 300) : current.heroImageAlt;
        if (!validImageUrl(heroImageUrl)) throw Object.assign(new Error('Use an https image URL or a path inside the public site.'), { statusCode: 400 });
        if (!heroImageAlt) throw Object.assign(new Error('Add descriptive alt text for the hero image.'), { statusCode: 400 });
        const updated = { ...current, heroImageUrl, heroImageAlt };
        if (input.newsletterAds !== undefined) {
          const newsletterAds = normalizeNewsletterAds(input.newsletterAds);
          if (!newsletterAds) throw Object.assign(new Error('Sponsored cards need valid image and destination URLs; active cards also need a title, sponsor, description, and alt text.'), { statusCode: 400 });
          updated.newsletterAds = newsletterAds;
        }
        if (input.footerCoverageLinks !== undefined) {
          const footerCoverageLinks = normalizeFooterCoverageLinks(input.footerCoverageLinks);
          if (!footerCoverageLinks) throw Object.assign(new Error('Footer coverage links need a label and a lowercase topic key, with no more than 8 links.'), { statusCode: 400 });
          updated.footerCoverageLinks = footerCoverageLinks;
        }
        for (const key of Object.keys(defaultSiteSettings)) {
          if (key === 'heroImageUrl' || key === 'heroImageAlt' || key === 'newsletterAds' || key === 'footerCoverageLinks' || input[key] === undefined) continue;
          if (key === 'welcomeEmailEnabled') {
            if (typeof input[key] !== 'boolean') throw Object.assign(new Error('Welcome email enabled must be true or false.'), { statusCode: 400 });
            updated[key] = input[key];
            continue;
          }
          if (footerTextLimits[key]) {
            if (typeof input[key] !== 'string' || input[key].trim().length > footerTextLimits[key]) {
              throw Object.assign(new Error(`${key} must be text no longer than ${footerTextLimits[key]} characters.`), { statusCode: 400 });
            }
            updated[key] = input[key].trim();
            continue;
          }
          const value = typeof input[key] === 'string' ? input[key].trim() : null;
          const valid = key === 'contactEmail' ? validEmail(value) : validFooterUrl(value);
          if (!valid) throw Object.assign(new Error(key === 'contactEmail' ? 'Enter a valid contact email address.' : 'Use an https URL, a site path, or a page anchor for footer links.'), { statusCode: 400 });
          updated[key] = value;
        }
        await writeSettings(updated);
        return updated;
      },
    };
  }

  return {
    async initialize() {
      await pool.query('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL)');
      for (const [key, value] of Object.entries(defaultSiteSettings)) {
        await pool.query('INSERT INTO site_settings (key,value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO NOTHING', [key, JSON.stringify(value)]);
      }
    },
    async get() {
      const { rows } = await pool.query('SELECT key,value FROM site_settings');
      return rows.reduce((settings, row) => ({ ...settings, [row.key]: row.value }), { ...defaultSiteSettings });
    },
    async update(input) {
      const current = await this.get();
      const heroImageUrl = typeof input.heroImageUrl === 'string' ? input.heroImageUrl.trim() : current.heroImageUrl;
      const heroImageAlt = typeof input.heroImageAlt === 'string' ? input.heroImageAlt.trim().slice(0, 300) : current.heroImageAlt;
      if (!validImageUrl(heroImageUrl)) throw Object.assign(new Error('Use an https image URL or a path inside the public site.'), { statusCode: 400 });
      if (!heroImageAlt) throw Object.assign(new Error('Add descriptive alt text for the hero image.'), { statusCode: 400 });
      const updated = { ...current, heroImageUrl, heroImageAlt };
      if (input.newsletterAds !== undefined) {
        const newsletterAds = normalizeNewsletterAds(input.newsletterAds);
        if (!newsletterAds) throw Object.assign(new Error('Sponsored cards need valid image and destination URLs; active cards also need a title, sponsor, description, and alt text.'), { statusCode: 400 });
        updated.newsletterAds = newsletterAds;
      }
      if (input.footerCoverageLinks !== undefined) {
        const footerCoverageLinks = normalizeFooterCoverageLinks(input.footerCoverageLinks);
        if (!footerCoverageLinks) throw Object.assign(new Error('Footer coverage links need a label and a lowercase topic key, with no more than 8 links.'), { statusCode: 400 });
        updated.footerCoverageLinks = footerCoverageLinks;
      }
      for (const key of Object.keys(defaultSiteSettings)) {
        if (key === 'heroImageUrl' || key === 'heroImageAlt' || key === 'newsletterAds' || key === 'footerCoverageLinks' || input[key] === undefined) continue;
        if (key === 'welcomeEmailEnabled') {
          if (typeof input[key] !== 'boolean') throw Object.assign(new Error('Welcome email enabled must be true or false.'), { statusCode: 400 });
          updated[key] = input[key];
          continue;
        }
        if (footerTextLimits[key]) {
          if (typeof input[key] !== 'string' || input[key].trim().length > footerTextLimits[key]) {
            throw Object.assign(new Error(`${key} must be text no longer than ${footerTextLimits[key]} characters.`), { statusCode: 400 });
          }
          updated[key] = input[key].trim();
          continue;
        }
        const value = typeof input[key] === 'string' ? input[key].trim() : null;
        const valid = key === 'contactEmail' ? validEmail(value) : validFooterUrl(value);
        if (!valid) throw Object.assign(new Error(key === 'contactEmail' ? 'Enter a valid contact email address.' : 'Use an https URL, a site path, or a page anchor for footer links.'), { statusCode: 400 });
        updated[key] = value;
      }
      for (const [key, value] of Object.entries(updated)) {
        await pool.query('INSERT INTO site_settings (key,value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [key, JSON.stringify(value)]);
      }
      return this.get();
    },
  };
}