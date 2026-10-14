import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { AnalyticsValidationError, createAnalyticsStore } from './analytics-store.js';
import { articles } from './articles.js';
import { createSubscriptionStore, SubscriptionValidationError } from './subscription-store.js';
import { emailDeliveryConfigured, sendEditorialInvitation, sendVerificationEmail, sendWelcomeEmail, siteBaseUrl } from './mailer.js';
import { createEditorialStore } from './editorial-store.js';
import { createAuthStore } from './auth-store.js';
import { createSiteSettingsStore, defaultSiteSettings } from './site-settings-store.js';
import { createListmonkClient, ListmonkError } from './listmonk-client.js';
import { createMediaStore, maxImageBytes } from './media-store.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const subscribersFile = process.env.SUBSCRIBERS_FILE || join(root, 'server', 'data', 'subscribers.json');
const databasePool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 10_000 }) : null;
const subscriptionStore = createSubscriptionStore({ pool: databasePool, filePath: subscribersFile, sendVerification: sendVerificationEmail });
const analyticsStore = createAnalyticsStore(databasePool, { filePath: join(root, 'server', 'data', 'analytics-events.json') });
const editorialStore = createEditorialStore(databasePool, articles);
const authStore = createAuthStore(databasePool);
const siteSettingsStore = createSiteSettingsStore(databasePool);
const mediaStore = createMediaStore({ pool: databasePool, directory: process.env.MEDIA_DIRECTORY || undefined });
const listmonkClient = createListmonkClient();
const port = Number(process.env.PORT || 5174);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
};
const loginAttempts = new Map();

function sessionToken(request) {
  const cookie = request.headers.cookie || '';
  const entry = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith('aztech_session='));
  return entry ? decodeURIComponent(entry.slice('aztech_session='.length)) : null;
}

function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `aztech_session=${encodeURIComponent(token || '')}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

async function requireUser(request, response, roles = []) {
  if (!authStore) {
    sendJson(response, 503, { error: 'Editorial accounts are unavailable until PostgreSQL is configured.' });
    return null;
  }
  const user = await authStore.getSession(sessionToken(request));
  if (!user) {
    sendJson(response, 401, { error: 'Sign in to continue.' });
    return null;
  }
  if (roles.length && !roles.includes(user.role)) {
    sendJson(response, 403, { error: 'Your role does not allow this action.' });
    return null;
  }
  return user;
}
function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}
function escapeXml(value = '') {
  return String(value).replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
}

async function parseBody(request, maxLength = 16_384) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > maxLength) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
  }
  return JSON.parse(raw || '{}');
}

async function serveStatic(request, response) {
  const requestedPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const publicRoot = join(root, 'dist');
  const filePath = resolve(publicRoot, `.${requestedPath}`);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    response.end(file);
  } catch {
    try {
      const index = await readFile(join(publicRoot, 'index.html'));
      response.writeHead(200, { 'content-type': mimeTypes['.html'] });
      response.end(index);
    } catch {
      sendJson(response, 503, { error: 'Frontend is not built yet. Run npm run build.' });
    }
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      await subscriptionStore.stats();
      sendJson(response, 200, { status: 'ok', database: databasePool ? 'connected' : 'local-fallback' });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/media') {
      const user = await requireUser(request, response, ['author', 'admin']);
      if (!user) return;
      const body = await parseBody(request, 5_700_000);
      if (typeof body.dataBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.dataBase64)) {
        sendJson(response, 400, { error: 'Choose a valid JPEG, PNG, or WebP image.' });
        return;
      }
      const data = Buffer.from(body.dataBase64, 'base64');
      if (data.toString('base64').replace(/=+$/, '') !== body.dataBase64.replace(/=+$/, '')) {
        sendJson(response, 400, { error: 'Choose a valid JPEG, PNG, or WebP image.' });
        return;
      }
      const uploaded = await mediaStore.save({ data, mimeType: body.mimeType, uploadedBy: user.email });
      sendJson(response, 201, uploaded);
      return;
    }
    const mediaMatch = url.pathname.match(/^\/api\/media\/([0-9a-f-]{36})$/i);
    if (request.method === 'GET' && mediaMatch) {
      const media = await mediaStore.get(mediaMatch[1]);
      if (!media) {
        sendJson(response, 404, { error: 'Image not found.' });
        return;
      }
      response.writeHead(200, {
        'content-type': media.mimeType,
        'content-length': media.data.length,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      });
      response.end(media.data);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/articles') {
      sendJson(response, 200, editorialStore ? await editorialStore.listPublished() : articles);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/authors') {
      sendJson(response, 200, await authStore.listPublicAuthors());
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/feed.xml') {
      const publishedArticles = (editorialStore ? await editorialStore.listPublished() : articles).filter((article) => article.status === 'published' || !editorialStore);
      const items = publishedArticles.map((article) => `<item><title>${escapeXml(article.title)}</title><link>${escapeXml(`${siteBaseUrl}/#story=${encodeURIComponent(article.id)}`)}</link><guid isPermaLink="false">${escapeXml(article.id)}</guid><description>${escapeXml(article.description)}</description><pubDate>${new Date(article.publishedAt || Date.now()).toUTCString()}</pubDate></item>`).join('');
      response.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
      response.end(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>AzTech Africa</title><link>${escapeXml(siteBaseUrl)}</link><description>Independent intelligence from Silicon Dar and East African tech.</description>${items}</channel></rss>`);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/site-settings') {
      sendJson(response, 200, siteSettingsStore ? await siteSettingsStore.get() : defaultSiteSettings);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/analytics/events') {
      sendJson(response, 202, await analyticsStore.record(await parseBody(request, 4096)));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/analytics') {
      const user = await requireUser(request, response, ['admin']);
      if (!user) return;
      sendJson(response, 200, await analyticsStore.summary({ days: url.searchParams.get('days') }));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/stats') {
      const subscriberStats = await subscriptionStore.stats();
      const publishedArticles = editorialStore ? await editorialStore.listPublished() : articles.filter((article) => article.category !== 'archive');
      sendJson(response, 200, {
        publishedStories: publishedArticles.length,
        countriesCovered: new Set(publishedArticles.flatMap((article) => article.countries || [])).size,
        ...subscriberStats,
      });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      const user = authStore ? await authStore.getSession(sessionToken(request)) : null;
      sendJson(response, 200, { user });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      if (!authStore) {
        sendJson(response, 503, { error: 'Editorial accounts are unavailable until PostgreSQL is configured.' });
        return;
      }
      const body = await parseBody(request);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const key = `${request.socket.remoteAddress || 'unknown'}:${email}`;
      const attempts = loginAttempts.get(key);
      if (attempts && attempts.count >= 8 && attempts.until > Date.now()) {
        sendJson(response, 429, { error: 'Too many sign-in attempts. Try again in 15 minutes.' });
        return;
      }
      const login = await authStore.login(email, body.password);
      if (!login) {
        const current = loginAttempts.get(key);
        loginAttempts.set(key, { count: current?.until > Date.now() ? current.count + 1 : 1, until: Date.now() + 15 * 60 * 1000 });
        sendJson(response, 401, { error: 'Email or password is incorrect.' });
        return;
      }
      loginAttempts.delete(key);
      response.setHeader('set-cookie', sessionCookie(login.token, 12 * 60 * 60));
      sendJson(response, 200, { user: login.user });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/setup-password') {
      if (!authStore) {
        sendJson(response, 503, { error: 'Editorial accounts are unavailable until PostgreSQL is configured.' });
        return;
      }
      const body = await parseBody(request);
      sendJson(response, 200, await authStore.completePasswordSetup(body.token, body.password));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      await authStore?.logout(sessionToken(request));
      response.setHeader('set-cookie', sessionCookie('', 0));
      sendJson(response, 200, { signedOut: true });
      return;
    }
    if (url.pathname === '/api/editorial/articles' && request.method === 'GET') {
      const user = await requireUser(request, response, ['author', 'admin']);
      if (!user) return;
      sendJson(response, 200, await editorialStore.listForUser(user));
      return;
    }
    if (url.pathname === '/api/editorial/articles' && request.method === 'POST') {
      const user = await requireUser(request, response, ['author', 'admin']);
      if (!user) return;
      sendJson(response, 201, await editorialStore.saveDraft(await parseBody(request), user));
      return;
    }
    if (url.pathname === '/api/editorial/profile' && request.method === 'PATCH') {
      const user = await requireUser(request, response, ['author', 'admin']);
      if (!user) return;
      sendJson(response, 200, await authStore.updateProfile(user.id, await parseBody(request)));
      return;
    }
    const editorialMatch = url.pathname.match(/^\/api\/editorial\/articles\/([^/]+)(?:\/(submit|review|suspend|restore))?$/);
    if (editorialMatch) {
      const user = await requireUser(request, response, ['author', 'admin']);
      if (!user) return;
      const [, articleId, action] = editorialMatch;
      if (request.method === 'PATCH' && !action) {
        sendJson(response, 200, await editorialStore.saveDraft({ ...await parseBody(request), id: articleId }, user));
        return;
      }
      if (request.method === 'POST' && action === 'submit' && user.role === 'author') {
        const updated = await editorialStore.submitForReview(articleId, user);
        sendJson(response, updated ? 200 : 409, updated || { error: 'Only your own drafts can be submitted.' });
        return;
      }
      if (request.method === 'POST' && action === 'review' && user.role === 'admin') {
        const body = await parseBody(request);
        if (!['publish', 'return'].includes(body.action)) {
          sendJson(response, 400, { error: 'Choose publish or return.' });
          return;
        }
        const updated = await editorialStore.review(articleId, body.action, body.note);
        sendJson(response, updated ? 200 : 409, updated || { error: 'This story is no longer awaiting review.' });
        return;
      }
      if (request.method === 'POST' && ['suspend', 'restore'].includes(action) && user.role === 'admin') {
        const updated = await editorialStore.setStatus(articleId, action === 'suspend' ? 'archived' : 'published');
        sendJson(response, updated ? 200 : 404, updated || { error: 'Story not found.' });
        return;
      }
      if (request.method === 'DELETE' && !action && user.role === 'admin') {
        const deleted = await editorialStore.deleteById(articleId);
        sendJson(response, deleted ? 200 : 404, deleted ? { deleted: true } : { error: 'Story not found.' });
        return;
      }
      sendJson(response, 403, { error: 'This editorial action is not allowed.' });
      return;
    }
    if (url.pathname === '/api/admin/users') {
      const user = await requireUser(request, response, ['admin']);
      if (!user) return;
      if (request.method === 'GET') {
        sendJson(response, 200, await authStore.listUsers());
        return;
      }
      if (request.method === 'POST') {
        const body = await parseBody(request);
        const created = await authStore.createUser(body.email, body.password, body.role);
        if (created.setupToken) {
          const setupUrl = `${siteBaseUrl}/?setup=${encodeURIComponent(created.setupToken)}#studio`;
          delete created.setupToken;
          let invitationSent = false;
          if (emailDeliveryConfigured) {
            try { invitationSent = await sendEditorialInvitation({ email: created.email, setupUrl }); }
            catch { invitationSent = false; }
          }
          sendJson(response, 201, { ...created, invitationSent, ...(!invitationSent ? { setupUrl } : {}) });
          return;
        }
        sendJson(response, 201, created);
        return;
      }
    }
    if (url.pathname === '/api/admin/site-settings' && request.method === 'PATCH') {
      const user = await requireUser(request, response, ['admin']);
      if (!user) return;
      sendJson(response, 200, await siteSettingsStore.update(await parseBody(request)));
      return;
    }
    const adminUserMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/(role|active|profile)$/);
    if (adminUserMatch && request.method === 'PATCH') {
      const user = await requireUser(request, response, ['admin']);
      if (!user) return;
      const [, userId, field] = adminUserMatch;
      const body = await parseBody(request);
      const updated = field === 'role'
        ? await authStore.setUserRole(userId, body.role, user.id)
        : field === 'profile' ? await authStore.updateProfile(userId, body)
          : typeof body.active === 'boolean' ? await authStore.setUserActive(userId, body.active, user.id) : null;
      sendJson(response, updated ? 200 : 404, updated || { error: 'User not found or update is invalid.' });
      return;
    }
    if (url.pathname.startsWith('/api/admin/newsletter')) {
      const user = await requireUser(request, response, ['admin']);
      if (!user) return;
      if (request.method === 'GET' && url.pathname === '/api/admin/newsletter/crm') {
        sendJson(response, 200, await subscriptionStore.crm({
          search: url.searchParams.get('search') || '',
          status: url.searchParams.get('status') || 'all',
          page: url.searchParams.get('page'),
          perPage: url.searchParams.get('perPage'),
        }));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/admin/newsletter/welcome') {
        const settings = await siteSettingsStore.get();
        sendJson(response, 200, {
          enabled: settings.welcomeEmailEnabled !== false,
          subject: settings.welcomeEmailSubject,
          body: settings.welcomeEmailBody,
          emailDeliveryConfigured,
        });
        return;
      }
      if (request.method === 'PATCH' && url.pathname === '/api/admin/newsletter/welcome') {
        const body = await parseBody(request);
        const settings = await siteSettingsStore.update({
          welcomeEmailEnabled: body.enabled,
          welcomeEmailSubject: body.subject,
          welcomeEmailBody: body.body,
        });
        sendJson(response, 200, {
          enabled: settings.welcomeEmailEnabled !== false,
          subject: settings.welcomeEmailSubject,
          body: settings.welcomeEmailBody,
          emailDeliveryConfigured,
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/newsletter/welcome/test') {
        const body = await parseBody(request);
        if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
          sendJson(response, 400, { error: 'Enter a valid test recipient email.' });
          return;
        }
        if (!emailDeliveryConfigured) {
          sendJson(response, 503, { error: 'Configure Resend and a verified sender before sending welcome emails.' });
          return;
        }
        const settings = await siteSettingsStore.get();
        await sendWelcomeEmail({ email: body.email.trim(), subject: settings.welcomeEmailSubject, body: settings.welcomeEmailBody });
        sendJson(response, 200, { sent: true });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/admin/newsletter') {
        const { confirmedSubscribers } = await subscriptionStore.stats();
        sendJson(response, 200, await listmonkClient.dashboard(confirmedSubscribers));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/newsletter/setup-audience') {
        const result = await listmonkClient.setupAudience(await subscriptionStore.audience());
        sendJson(response, 200, result);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/newsletter/sync') {
        const body = await parseBody(request);
        sendJson(response, 200, await listmonkClient.syncAudience(await subscriptionStore.audience(), body.listId));
        return;
      }
      const campaignIdMatch = url.pathname.match(/^\/api\/admin\/newsletter\/campaigns\/([^/]+)$/);
      if (request.method === 'GET' && campaignIdMatch) {
        sendJson(response, 200, await listmonkClient.getCampaign(campaignIdMatch[1]));
        return;
      }
      if (request.method === 'PATCH' && campaignIdMatch) {
        sendJson(response, 200, await listmonkClient.updateCampaign(campaignIdMatch[1], await parseBody(request, 1_000_000)));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/newsletter/campaigns') {
        const body = await parseBody(request, 1_000_000);
        sendJson(response, 201, await listmonkClient.createCampaign(body));
        return;
      }
      const campaignAction = url.pathname.match(/^\/api\/admin\/newsletter\/campaigns\/([^/]+)\/(test|send)$/);
      if (request.method === 'POST' && campaignAction) {
        const [, campaignId, action] = campaignAction;
        const body = await parseBody(request);
        const result = action === 'test'
          ? await listmonkClient.sendTest(campaignId, body.email)
          : await listmonkClient.sendCampaign(campaignId, await subscriptionStore.audience());
        sendJson(response, 200, result);
        return;
      }
      sendJson(response, 404, { error: 'Newsletter admin route not found.' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/subscriptions/verify') {
      const subscriber = await subscriptionStore.verifySubscriber(url.searchParams.get('token'));
      const verified = Boolean(subscriber);
      if (subscriber && emailDeliveryConfigured) {
        try {
          const settings = await siteSettingsStore.get();
          if (settings.welcomeEmailEnabled !== false && await sendWelcomeEmail({ email: subscriber.email, subject: settings.welcomeEmailSubject, body: settings.welcomeEmailBody })) {
            await subscriptionStore.recordWelcomeSent(subscriber.email);
          }
        } catch {}
      }
      response.writeHead(302, { location: `${siteBaseUrl}/?subscription=${verified ? 'verified' : 'verification-invalid'}#newsletter-section` });
      response.end();
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/subscriptions/manage') {
      const subscriber = await subscriptionStore.manage(url.searchParams.get('token'));
      if (!subscriber) {
        sendJson(response, 404, { error: 'This preference link is invalid or no longer active.' });
        return;
      }
      sendJson(response, 200, { email: subscriber.email, swahiliSummary: subscriber.swahili_summary, country: subscriber.country || 'Tanzania', interests: subscriber.interests || [], status: subscriber.status });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/subscriptions/manage') {
      const body = await parseBody(request);
      const updated = await subscriptionStore.updatePreferences(body.token, body);
      sendJson(response, updated ? 200 : 404, { updated, message: updated ? 'Your preferences have been saved.' : 'This preference link is invalid or inactive.' });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/subscriptions/unsubscribe') {
      const body = await parseBody(request);
      const unsubscribed = await subscriptionStore.unsubscribe(body.token);
      sendJson(response, unsubscribed ? 200 : 404, { unsubscribed, message: unsubscribed ? 'You have been unsubscribed.' : 'This unsubscribe link is invalid or already used.' });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/subscriptions') {
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        sendJson(response, 415, { error: 'Send the subscription as JSON.' });
        return;
      }
      const body = await parseBody(request);
      const result = await subscriptionStore.subscribe(body);
      const message = result.pending
        ? result.emailSent
          ? 'Check your inbox to confirm your subscription. The confirmation link expires in 24 hours.'
          : 'Your request is saved, but email verification is not configured yet. No newsletter will be sent until you confirm.'
        : result.preferencesUpdated
          ? 'Your newsletter preferences have been updated.'
          : 'This email is already subscribed.';
      sendJson(response, result.pending ? 202 : result.alreadySubscribed ? 200 : 201, {
        ...result,
        emailDeliveryConfigured,
        message,
      });
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'API route not found.' });
      return;
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      await serveStatic(request, response);
      return;
    }
    sendJson(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    const statusCode = error instanceof SubscriptionValidationError
      ? error.statusCode
      : error.statusCode || (error instanceof SyntaxError ? 400 : 500);
    sendJson(response, statusCode, {
      error: error instanceof SubscriptionValidationError
        ? error.message
        : error instanceof AnalyticsValidationError
          ? error.message
        : error instanceof ListmonkError
          ? error.message
        : error instanceof SyntaxError
          ? 'Request body must be valid JSON.'
          : statusCode === 413
            ? 'Request body is too large.'
            : 'The request could not be completed.',
    });
  }
});

await subscriptionStore.initialize();
await analyticsStore.initialize();
await editorialStore?.initialize();
await authStore?.initialize();
await siteSettingsStore?.initialize();
await mediaStore.initialize();
server.listen(port, () => console.log(`AzTech Africa API listening on http://localhost:${port}`));
