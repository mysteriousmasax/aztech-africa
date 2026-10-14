# AzTech Africa

A responsive React + Vite publication site with a Node.js API. In production, newsletter subscriptions are stored in the Railway PostgreSQL database. Locally, the API falls back to `server/data/subscribers.json` unless `DATABASE_URL` is set.

The homepage hero uses the Dar es Salaam digital-corridor concept artwork supplied for AzTech Africa.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```powershell
npm install
$env:PORT = 4174
$env:VITE_PORT = 4173
npm run dev
```

Open http://localhost:4173. Vite proxies `/api` requests to the Node API on port 4174.

If those ports are already occupied, change both values to a free port pair before starting the app.

## Production

```powershell
npm run build
npm start
```

The Node server serves the built site and API on port 5174 by default. Set `PORT` to change the port.

Run the newsletter store tests with `npm test`.

## Deploy to Railway

Connect this GitHub repository to a Railway project. Railway uses `railway.json` to build the Vite frontend, start the Node server, and check `/api/health`.

The production service uses the Railway Postgres service through `DATABASE_URL`. The API creates the `newsletter_subscribers` table at startup. Local JSON storage is only a development fallback; no Railway volume is needed for subscription persistence.

### Editorial accounts and email

Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` (at least 6 characters) in the Railway app service Variables. This bootstraps/rotates the initial admin on app startup. Sign in from the **Author Studio** link. Do not commit the password or share it in chat.

Existing articles receive `makayaemmanuel42@gmail.com` as their owner during the editorial-store migration, without changing their public author byline. Admins can edit published articles, suspend and restore them, or delete them. Authors can still edit and submit only their own stories.

The studio supports author drafts, preview, review submission, admin return/publish, and adding author/admin accounts. Opportunity and Event drafts include structured fields for deadlines, eligibility, venue, registration, official sources, and verification dates. New stories publish to Postgres and appear in the public feed after approval.

Authors and admins can upload JPEG, PNG, or WebP images up to 4 MB for profiles, story covers, the publication hero, and newsletter sponsor cards. With `DATABASE_URL`, uploaded bytes are stored in Postgres; local fallback uploads are saved under `server/data/uploads` or the configured `MEDIA_DIRECTORY`. Newsletter campaigns load published stories from the article feed, default to up to three illustrated stories, and let editors select up to three; selected story content appears in the email preview even when an article has no image.

For email delivery, create a Resend account, verify the sending domain, then set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and optionally `RESEND_FROM_NAME` on the Railway app service. The HTTPS API sends subscription confirmations without Railway SMTP access. Until these variables are configured, signups remain pending and the UI reports that confirmation email is unavailable. Verification links expire after 24 hours; the manage link supports Swahili preferences and unsubscribe.

For bulk campaigns, configure a reachable Listmonk instance and set `LISTMONK_URL`, `LISTMONK_API_USER`, and `LISTMONK_API_TOKEN` in the Railway app service Variables. Create an active mailing list in Listmonk, then use the admin **Campaigns** tab to sync confirmed subscribers, compose drafts, send test emails, and start campaigns. Before a campaign starts, the API synchronizes its audience and propagates unsubscribes. Keep Listmonk API credentials private and do not commit them.

Set `SITE_URL` to the verified public site origin so verification links return to the right domain. The current Railway/custom domain is `https://aztechafrica.site`; change this only after configuring a different verified domain.

To use a custom Namecheap domain, add the domain in the Railway service's networking settings first. Copy the DNS record targets Railway displays into Namecheap's Advanced DNS. Use Railway's supplied CNAME target for a subdomain such as `www`; for an apex domain (`@`), use the ALIAS/ANAME or other apex record Railway specifies. DNS targets are generated for the Railway service, so do not guess an IP or reuse a target from another project. Railway provisions HTTPS after DNS verification.

Railway supplies its own deployment credentials through your Railway account and GitHub connection. Do not put access tokens or API keys in this repository.

Listmonk handles campaign composition, audience sync, and unsubscribe propagation. A private Docker SMTP relay translates its messages to Resend's HTTPS API, avoiding Railway's outbound SMTP restriction. Configure the relay with `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `SMTP_RELAY_USER`, and `SMTP_RELAY_PASSWORD`; point Listmonk's SMTP settings at the relay's private Railway hostname on port `2525`. Use the same verified Resend sender for confirmations and campaigns.

## API

- `GET /api/health` returns service health.
- `GET /api/articles` returns the featured and archived editorial content.
- `GET /api/authors` returns active author profiles with published stories, social links, and published story IDs. Authors manage public profile details in the Author Studio profile page.
- `POST /api/analytics/events` accepts anonymous page views, story opens, completed reads, and public link/button clicks. Query strings, IP addresses, and user agents are not stored.
- Admins can review page views, story opens, 90%-complete story reads, click counts, daily/weekly activity, top stories, and top clicked destinations in **Author Studio → Analytics**. `GET /api/admin/analytics?days=30` is admin-only and supports periods from 1 to 365 days.
- Admins can manage campaign history and compose/test/send newsletters in **Author Studio → Newsletter**, review searchable and exportable subscriber records in **CRM**, and configure the post-verification welcome email in **Welcome email**. Authors only see their overview, stories, and profile pages.
- `GET /api/admin/newsletter/crm` is admin-only and accepts `search`, `status`, `page`, and `perPage` query parameters. It returns subscriber preferences, consent and verification dates, status counts, and welcome-email delivery timestamps.
- Admins can load and edit existing Listmonk drafts, send test messages, synchronize the audience, send immediately, or schedule a newsletter from **Author Studio → Newsletter**. Scheduled newsletters can be edited or explicitly returned to draft.
- `GET /api/admin/newsletter/campaigns/{id}` and `PATCH /api/admin/newsletter/campaigns/{id}` are admin-only campaign detail and update routes. New campaigns accept an optional future `sendAt` timestamp.
- Admin story moderation uses `POST /api/editorial/articles/{id}/suspend`, `POST /api/editorial/articles/{id}/restore`, and `DELETE /api/editorial/articles/{id}`. Suspension hides a story without deleting its content.
- `POST /api/subscriptions` accepts `{ "email": "name@example.com", "swahiliSummary": true, "country": "Tanzania", "interests": ["funding", "events"], "consent": true, "source": "hero" }`. Consent is required, addresses and reader preferences are validated, and repeat signups update preferences without creating duplicate records.
- Published Opportunity and Event articles may include a `metadata` object. Opportunity metadata uses `opportunityType`, `organization`, `amount`, `deadline`, `location`, `eligibility`, `sourceUrl`, and `verifiedAt`; Event metadata uses `startDate`, `endDate`, `venue`, `cost`, `audience`, `registrationUrl`, `sourceUrl`, and `verifiedAt`.

The API stores signup records, consent timestamps, source, and Swahili-summary preference. It does not verify addresses, send newsletter email, or process unsubscribe requests. Configure an email provider before advertising delivery or unsubscribe support.
