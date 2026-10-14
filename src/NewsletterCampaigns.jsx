import { useEffect, useRef, useState } from 'react';

const emptyDashboard = { configured: false, activeSubscriberCount: 0, lists: [], campaigns: [] };
const emptyCampaign = {
  name: '',
  subject: '',
  preheader: '',
  postalAddress: '',
  swahiliSubject: '',
  body: buildNewsletterStarterContent(),
  swahiliBody: `<p style="margin:0 0 18px;color:#43566b;font-size:15px;line-height:1.65">Muhtasari wa wiki hii unaangazia ufadhili mpya, hatua za sera na fursa za vitendo kwa waanzilishi na waendeshaji Afrika Mashariki.</p>
<h2 style="margin:22px 0 8px;color:#123557;font-size:19px;line-height:1.3">Ufadhili na mikataba</h2>
<p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">Taja kampuni, kiasi na hatua ya ufadhili ikiwa vimethibitishwa, nchi husika na chanzo cha taarifa.</p>
<h2 style="margin:22px 0 8px;color:#123557;font-size:19px;line-height:1.3">Sera na kanuni</h2>
<p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">Eleza kilichobadilika, mdhibiti anayehusika, watu wanaoathirika na tarehe muhimu.</p>
<h2 style="margin:22px 0 8px;color:#123557;font-size:19px;line-height:1.3">Fursa na matukio</h2>
<p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">Jumuisha tarehe ya mwisho, vigezo, gharama, eneo na kiungo rasmi.</p>
<h2 style="margin:22px 0 8px;color:#123557;font-size:19px;line-height:1.3">Somo la mtekelezaji</h2>
<p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">Shiriki maarifa ya vitendo kutoka kwa mwanzilishi au mtoa huduma wa teknolojia.</p>
<h2 style="margin:22px 0 8px;color:#123557;font-size:19px;line-height:1.3">Viungo muhimu</h2>
<p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">Ongeza chanzo cha awali, taarifa ya mdhibiti na ukurasa rasmi wa maombi au usajili.</p>`,
  listId: '',
  fromEmail: '',
  sendAt: '',
  segment: 'founders',
  issueType: 'decision-ready',
  sections: {
    signals: true,
    funding: true,
    policy: true,
    opportunities: true,
    operatorStory: true,
    links: true,
  },
};

function formatDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function sponsoredCardKey(card) {
  return `${card.sponsor}|${card.title}|${card.clickUrl}`;
}

function buildStoryBlocks(stories = []) {
  if (!stories.length) return '';
  const cards = stories.slice(0, 3).map((story) => {
    const storyUrl = `${window.location.origin}/#story=${encodeURIComponent(story.id)}`;
    const imageUrl = story.imageUrl ? story.imageUrl.startsWith('/') ? `${window.location.origin}${story.imageUrl}` : story.imageUrl : '';
    const image = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(story.imageAlt || '')}" width="592" style="display:block;width:100%;height:auto;border-radius:5px;margin:0 0 10px">` : '';
    return `<tr><td style="padding:0 0 18px"><a href="${escapeHtml(storyUrl)}" style="color:#123557;text-decoration:none">${image}<span style="color:#1478a5;font-size:10px;font-weight:bold;text-transform:uppercase">${escapeHtml(story.label || 'AzTech Africa')}</span><h2 style="margin:4px 0 6px;color:#123557;font-size:19px;line-height:1.3">${escapeHtml(story.cardTitle || story.title)}</h2></a><p style="margin:0;color:#526b82;font-size:14px;line-height:1.6">${escapeHtml(story.description || '')}</p></td></tr>`;
  }).join('');
  return `<h2 style="margin:24px 0 12px;color:#123557;font-size:20px">The latest from East Africa</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>`;
}

function buildStoryTableOfContents(stories = []) {
  const links = stories.slice(0, 3).map((story) => {
    const storyUrl = `${window.location.origin}/#story=${encodeURIComponent(story.id)}`;
    return `<a href="${escapeHtml(storyUrl)}" style="color:#fff">${escapeHtml(story.cardTitle || story.title)}</a>`;
  }).join('<br>');
  if (!links) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="padding:12px;background:#06182a;color:#fff;font-family:Georgia,serif;font-size:19px;font-weight:bold">THIS WEEK'S SIGNALS</td></tr><tr><td style="padding:14px;background:#153852;color:#eee;font-size:15px;line-height:1.8">${links}</td></tr></table>`;
}

function buildSponsorBlocks(sponsoredCards = []) {
  const activeCards = sponsoredCards.filter((card) => card.active && card.title && card.imageUrl && card.clickUrl);
  if (!activeCards.length) return '';
  const cards = activeCards.map((card) => {
    const imageUrl = card.imageUrl.startsWith('/') ? `${window.location.origin}${card.imageUrl}` : card.imageUrl;
    return `<tr><td style="padding:0 0 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dce5ec;border-radius:5px"><tr><td style="padding:12px"><p style="margin:0 0 8px;color:#71859a;font-size:9px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Sponsored · ${escapeHtml(card.sponsor)}</p><a href="${escapeHtml(card.clickUrl)}" style="color:#123557;text-decoration:none"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(card.imageAlt)}" width="560" style="display:block;width:100%;height:auto;border-radius:4px;margin:0 0 9px"><h2 style="margin:0 0 6px;color:#123557;font-size:17px;line-height:1.35">${escapeHtml(card.title)}</h2></a><p style="margin:0;color:#526b82;font-size:13px;line-height:1.55">${escapeHtml(card.description)}</p><p style="margin:10px 0 0"><a href="${escapeHtml(card.clickUrl)}" style="color:#0b6899;font-size:12px;font-weight:bold">Learn more</a></p></td></tr></table></td></tr>`;
  }).join('');
  return `<h2 style="margin:24px 0 12px;color:#123557;font-size:20px">Partner message</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>`;
}

/*
function buildDecisionBriefTemplate({ segment = 'founders', issueType = 'decision-ready' } = {}) {
  const segmentTitle = {
    founders: 'Founders and operators',
    investors: 'Investors and ecosystem builders',
    policy: 'Policy and regulatory watchers',
    regional: 'Regional readers',
  }[segment] || 'Regional readers';

  return `

export function buildNewsletterStarterContent() {
  let content = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border-collapse:collapse"><tr><td><img src="https://aztechafrica.site/dar-es-salaam-hero.png" alt="Dar es Salaam skyline at dusk" width="592" style="display:block;width:100%;height:auto"></td></tr><tr><td align="center" style="padding:14px;background:#352d32;color:#fff;font-size:14px">In partnership with <strong style="display:inline-block;margin-left:8px;padding:9px 16px;background:#6936e8;color:#fff;font-size:18px">fincra</strong></td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#302829"><tr><td style="padding:14px 12px"><a href="https://aztechafrica.site/#newsletter-section" style="color:#fff;font-size:14px;font-weight:bold">Lire en Français</a></td><td align="right" dir="rtl" style="padding:14px 12px"><a href="https://aztechafrica.site/#newsletter-section" style="color:#fff;font-size:14px;font-weight:bold">اقرأ هذا باللغة العربية</a></td></tr></table>
    <p style="margin:0 0 8px;color:#f2f2f2;font-size:20px;line-height:1.45"><strong>Good morning. ☀️</strong></p>
    <p style="margin:0 0 12px;color:#d4d4d4;font-size:16px;line-height:1.7">Before you scroll, tell us what you want more of. <a href="https://aztechafrica.site/#newsletter-section" style="color:#ff806b">Share your feedback</a>. Let's dive in.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 20px;background:#392d30;border-radius:8px"><tr><td align="center" style="padding:22px 18px;color:#f1e9eb;font-size:17px;line-height:1.5">Read smart insights about Africa's technology economy every week.<br><a href="https://aztechafrica.site/#newsletter-section" style="display:inline-block;margin-top:14px;padding:12px 22px;background:#e84a20;border-radius:5px;color:#171717;font-size:16px;font-weight:bold;text-decoration:none">Subscribe</a></td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border-collapse:collapse"><tr><td colspan="2" style="padding:12px 14px;background:#111;color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:bold">IN TODAY'S EDITION</td></tr><tr><td colspan="2" style="padding:14px 16px;background:#392d30;color:#eee;font-size:15px;line-height:1.8"><a href="#big-tech" style="color:#fff">Microsoft's Nairobi engineering centre</a><br><a href="#fintech" style="color:#fff">Wise's South African licence</a><br><a href="#companies" style="color:#fff">iOCO's latest results</a><br><a href="#crypto" style="color:#fff">The crypto tracker</a><br><a href="#events" style="color:#fff">Upcoming founder events</a></td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#1c2a23"><tr><td align="center" style="padding:18px;color:#e4e8e5;font-size:14px;line-height:1.6"><strong style="color:#fff;font-size:17px">Francophone Africa, every week</strong><br>Get a focused briefing on the region's French-speaking technology ecosystem.<br><a href="https://aztechafrica.site/#newsletter-section" style="display:inline-block;margin-top:10px;color:#ff806b;font-weight:bold">Join the Francophone list</a></td></tr></table>
    <a id="big-tech" name="big-tech"></a><h2 style="margin:28px 0 12px;color:#b5a8af;font-family:Georgia,'Times New Roman',serif;font-size:23px">BIG TECH</h2>
    <h3 style="margin:0 0 12px;color:#f4eef2;font-size:21px;line-height:1.35">Microsoft closes a window in Nairobi</h3>
    <img src="https://aztechafrica.site/dar-es-salaam-hero.png" alt="East African city connected by digital infrastructure" width="592" style="display:block;width:100%;height:auto;margin:0 0 8px">
    <p style="margin:0 0 18px;color:#a5a5a5;font-size:12px;line-height:1.5">Image: AzTech Africa</p>
    <p style="margin:0 0 16px;color:#d4d4d4;font-size:16px;line-height:1.7">Microsoft is winding down its Africa Development Centre in Nairobi after seven years, putting hundreds of roles and a significant pool of local engineering experience in focus.</p>
    <p style="margin:0 0 14px;color:#d4d4d4;font-size:16px;line-height:1.7"><strong>What happened?</strong> Employees were asked to discuss exit options as the company reviews its Nairobi operations. The final impact has not been fully disclosed.</p>
    <p style="margin:0 0 14px;color:#d4d4d4;font-size:16px;line-height:1.7"><strong>Why are they doing this?</strong> Microsoft describes the move as part of a global restructuring while saying it remains committed to Kenya.</p>
    <p style="margin:0 0 14px;color:#d4d4d4;font-size:16px;line-height:1.7"><strong>Explain it simply:</strong> the centre was built to let African engineers create products for global markets. Its future now depends on where that work and talent move next.</p>
    <p style="margin:0 0 20px;color:#d4d4d4;font-size:16px;line-height:1.7"><strong>The timeline:</strong> Nairobi opened in 2019; Microsoft later reduced roles across the region; the company is now considering a further wind-down.</p>
    <p style="margin:0 0 26px;color:#c9c9c9;font-size:14px;line-height:1.8"><a href="https://x.com" style="color:#ff806b">Share on X</a> &nbsp;·&nbsp; <a href="https://linkedin.com" style="color:#ff806b">LinkedIn</a> &nbsp;·&nbsp; <a href="https://wa.me/?text=AzTech%20Africa" style="color:#ff806b">WhatsApp</a></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px;border:1px solid #454545"><tr><td align="center" style="padding:12px;color:#b5a8af;font-size:13px;font-weight:bold">HAPPY CUSTOMER SERVICE WEEK</td></tr><tr><td align="center" style="padding:14px;background:#f0eaff;color:#24145c"><strong style="font-size:25px">fincra</strong><br><img src="https://aztechafrica.site/aztech-africa-map.png" alt="AzTech Africa map artwork" width="170" style="display:block;width:170px;max-width:100%;height:auto;margin:10px auto"><span style="font-size:14px;line-height:1.5">We're with you for every mile.<br>Your success and ours are the same story.</span></td></tr></table>
    <a id="fintech" name="fintech"></a><h2 style="margin:28px 0 12px;color:#b5a8af;font-family:Georgia,'Times New Roman',serif;font-size:23px">FINTECH</h2>
    <h3 style="margin:0 0 12px;color:#f4eef2;font-size:21px;line-height:1.35">Wise builds its South African foothold</h3>
    <p style="margin:0 0 14px;color:#d4d4d4;font-size:16px;line-height:1.7">South Africa's Reserve Bank has appointed Wise Payments South Africa as a Category Two Authorised Dealer in foreign exchange, giving the company a clearer local regulatory footing.</p>
    <p style="margin:0 0 26px;color:#d4d4d4;font-size:16px;line-height:1.7"><strong>Why it matters:</strong> the licence supports certain foreign-exchange transactions. Customers should check the service terms and current limits before moving funds.</p>
    <a id="companies" name="companies"></a><h2 style="margin:28px 0 12px;color:#b5a8af;font-family:Georgia,'Times New Roman',serif;font-size:23px">COMPANIES</h2>
    <h3 style="margin:0 0 10px;color:#f4eef2;font-size:21px;line-height:1.35">iOCO's profit jumps 39%, but growth still needs work</h3>
    <p style="margin:0 0 22px;color:#d4d4d4;font-size:16px;line-height:1.7">A stronger bottom line is one signal. The next question is whether the business can turn it into durable growth and better customer outcomes.</p>
    <a id="crypto" name="crypto"></a><h2 style="margin:28px 0 12px;color:#b5a8af;font-family:Georgia,'Times New Roman',serif;font-size:23px">CRYPTO TRACKER</h2>
    <p style="margin:0 0 14px;color:#d4d4d4;font-size:16px">The World Wide Web3 · Source: CoinMarketCap</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;border-collapse:collapse;color:#eee;font-size:13px;text-align:left"><tr style="border-bottom:1px solid #555"><th style="padding:9px 4px">Coin</th><th style="padding:9px 4px">Value</th><th style="padding:9px 4px">Day</th><th style="padding:9px 4px">Month</th></tr><tr style="border-bottom:1px dashed #555"><td style="padding:10px 4px"><strong>Bitcoin</strong></td><td style="padding:10px 4px">$83,539</td><td style="padding:10px 4px;color:#ff7b70">-0.15%</td><td style="padding:10px 4px;color:#75d995">+7.87%</td></tr><tr style="border-bottom:1px dashed #555"><td style="padding:10px 4px"><strong>Ether</strong></td><td style="padding:10px 4px">$2,502</td><td style="padding:10px 4px;color:#ff7b70">-0.80%</td><td style="padding:10px 4px;color:#ff7b70">-0.28%</td></tr><tr style="border-bottom:1px dashed #555"><td style="padding:10px 4px"><strong>Bitway</strong></td><td style="padding:10px 4px">$2.68</td><td style="padding:10px 4px;color:#75d995">+48.88%</td><td style="padding:10px 4px;color:#75d995">+257.46%</td></tr><tr style="border-bottom:1px dashed #555"><td style="padding:10px 4px"><strong>Solana</strong></td><td style="padding:10px 4px">$107.29</td><td style="padding:10px 4px;color:#ff7b70">-0.74%</td><td style="padding:10px 4px;color:#75d995">+6.20%</td></tr></table>
    <p style="margin:0 0 26px;color:#c9c9c9;font-size:13px;font-style:italic">Data as of 06:37 AM WAT, October 14, 2026.</p>
    <a id="events" name="events"></a><h2 style="margin:28px 0 12px;color:#b5a8af;font-family:Georgia,'Times New Roman',serif;font-size:23px">EVENTS</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="padding:15px;background:#1c2a23;color:#eee;font-size:15px;line-height:1.6"><strong style="color:#fff">Seed G3 · Lagos · October 14-15</strong><br>Two days on building resilient ventures and reaching global markets. <a href="https://aztechafrica.site/#partners" style="color:#ff806b">Event details</a></td></tr><tr><td height="10"></td></tr><tr><td style="padding:15px;background:#17383b;color:#eee;font-size:15px;line-height:1.6"><strong style="color:#fff">OffChart NXT · Port Harcourt · October 22-23</strong><br>Founders, investors, and policymakers meet to build new markets. <a href="https://aztechafrica.site/#partners" style="color:#ff806b">Event details</a></td></tr><tr><td height="10"></td></tr><tr><td style="padding:15px;background:#302829;color:#eee;font-size:15px;line-height:1.6"><strong style="color:#fff">Moonshot · Lagos · October 28-29</strong><br>Courage and conviction for a new world. <a href="https://aztechafrica.site/#partners" style="color:#ff806b">Get your ticket</a></td></tr><tr><td height="10"></td></tr><tr><td style="padding:15px;background:#263146;color:#eee;font-size:15px;line-height:1.6"><strong style="color:#fff">Defence Futures Summit · Abuja · October 14-15</strong><br>Local innovation and technology for national security. <a href="https://aztechafrica.site/#partners" style="color:#ff806b">Event details</a></td></tr></table>
    <h2 style="margin:28px 0 12px;color:#b5a8af;font-family:Georgia,'Times New Roman',serif;font-size:23px">IN OTHER NEWS</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#392d30"><tr><td style="padding:16px;color:#eee;font-size:15px;line-height:1.8">&bull; <a href="https://aztechafrica.site/#featured-articles" style="color:#fff">West Africa's new mobile money rules could reshape deposits</a><br>&bull; <a href="https://aztechafrica.site/#featured-articles" style="color:#fff">A boardroom battle tests a regional bitcoin company</a><br>&bull; <a href="https://aztechafrica.site/#featured-articles" style="color:#fff">Researchers build a neural network that runs on light</a></td></tr></table>
    <p style="margin:0 0 20px;color:#c9c9c9;font-size:14px;line-height:1.6"><strong>Written by:</strong> AzTech Africa newsroom<br><strong>Edited by:</strong> Editorial desk</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#1c2a23"><tr><td align="center" style="padding:22px 18px;color:#e4e8e5;font-size:16px;line-height:1.6"><strong style="font-size:20px;color:#fff">Want more of AzTech Africa?</strong><br>Get clear reporting on the business and technology shaping East Africa.<br><a href="https://aztechafrica.site/#newsletter-section" style="display:inline-block;margin-top:14px;padding:11px 18px;background:#e84a20;color:#171717;font-weight:bold;text-decoration:none">Explore our newsletters</a></td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#e84a20"><tr><td style="padding:14px;color:#fff;font-size:15px;line-height:1.5"><strong>ADVERTISE WITH AZTECH AFRICA</strong><br>Reach founders, investors, and technology leaders across East Africa.</td></tr></table>
  `;
}
    <p style="margin:0 0 20px;color:#43566b;font-size:15px;line-height:1.65">This week: capital moving across the region, policy changes to watch, and practical opportunities for ${segmentTitle.toLowerCase()}.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse">
  const englishContent = (body || '').trim() || buildNewsletterStarterContent() || buildDecisionBriefTemplate({ segment, issueType });
      <tr><td width="42" valign="top" style="padding:12px 0;border-top:1px solid #dce5ec;color:#1478a5;font-size:11px;font-weight:bold">02</td><td style="padding:12px 0;border-top:1px solid #dce5ec"><p style="margin:0 0 4px;color:#1478a5;font-size:10px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Signal</p><h2 style="margin:0 0 5px;color:#123557;font-size:17px;line-height:1.35">The next development to know</h2><p style="margin:0;color:#526b82;font-size:13px;line-height:1.6"><strong>Why it matters:</strong> identify the opportunity, risk, or next action.</p></td></tr>
      <tr><td width="42" valign="top" style="padding:12px 0;border-top:1px solid #dce5ec;border-bottom:1px solid #dce5ec;color:#44ae7c;font-size:11px;font-weight:bold">03</td><td style="padding:12px 0;border-top:1px solid #dce5ec;border-bottom:1px solid #dce5ec"><p style="margin:0 0 4px;color:#1478a5;font-size:10px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Signal</p><h2 style="margin:0 0 5px;color:#123557;font-size:17px;line-height:1.35">One more regional shift</h2><p style="margin:0;color:#526b82;font-size:13px;line-height:1.6"><strong>Why it matters:</strong> show who is affected and what happens next.</p></td></tr>
  const editionDate = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
  const readOnlineUrl = `${window.location.origin}/`;
    </table>
    <h2 style="margin:22px 0 7px;color:#123557;font-size:19px;line-height:1.3">Funding and deals</h2>
    <p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">Name the company, amount and stage when verified, country, original source, and date checked.</p>
    <h2 style="margin:22px 0 7px;color:#123557;font-size:19px;line-height:1.3">Policy watch</h2>
    <p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">What changed, who the regulator affects, and the next relevant date.</p>
    <h2 style="margin:22px 0 7px;color:#123557;font-size:19px;line-height:1.3">Opportunities and events</h2>
    <p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">Deadlines, eligibility, cost, location, and official application or registration link.</p>
    <h2 style="margin:22px 0 7px;color:#123557;font-size:19px;line-height:1.3">Operator story</h2>
    <p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">One practical lesson from a founder, product team, or ecosystem operator.</p>
    <h2 style="margin:22px 0 7px;color:#123557;font-size:19px;line-height:1.3">Useful links</h2>
    <p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">A short list of primary sources and useful regional resources.</p>
  `;
}

*/

export function buildNewsletterStarterContent() {
  let content = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#0b1f38"><tr><td style="padding:16px;color:#fff"><img src="https://aztechafrica.site/aztech-africa-map.png" alt="AzTech Africa map mark" width="54" style="display:inline-block;width:54px;height:auto;vertical-align:middle;margin-right:12px"><strong style="color:#fff;font-size:14px;letter-spacing:1px">EAST AFRICA SIGNAL</strong><br><span style="display:inline-block;margin:7px 0 0 66px;color:#83c4e4;font-size:12px">Independent intelligence for builders</span></td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#123a58"><tr><td style="padding:12px;color:#fff;font-size:12px;font-weight:bold">ENGLISH EDITION</td><td align="right" style="padding:12px;color:#83c4e4;font-size:12px;font-weight:bold">KISWAHILI SUMMARY AVAILABLE</td></tr></table>
    <p style="margin:0 0 8px;color:#f2f2f2;font-size:20px"><strong>Good morning. ☀️</strong></p><p style="margin:0 0 16px;color:#d4d4d4;font-size:16px;line-height:1.7">Before you scroll, tell us what you want more of. <a href="https://aztechafrica.site/#newsletter-section" style="color:#ff806b">Share your feedback</a>. Let's dive in.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#123a58"><tr><td align="center" style="padding:20px;color:#eaf4f8;font-size:17px;line-height:1.5"><strong style="color:#fff">Clarity for your next move.</strong><br>Weekly reporting on the people, capital, and policy shaping East Africa.<br><a href="https://aztechafrica.site/#newsletter-section" style="display:inline-block;margin-top:12px;padding:11px 20px;background:#f06424;color:#0b1f38;font-weight:bold;text-decoration:none">Join the briefing</a></td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="padding:12px;background:#06182a;color:#fff;font-family:Georgia,serif;font-size:19px;font-weight:bold">THIS WEEK'S SIGNALS</td></tr><tr><td style="padding:14px;background:#153852;color:#eee;font-size:15px;line-height:1.8"><a href="#big-tech" style="color:#fff">Microsoft's Nairobi engineering centre</a><br><a href="#fintech" style="color:#fff">Wise's South African licence</a><br><a href="#companies" style="color:#fff">iOCO's latest results</a><br><a href="#crypto" style="color:#fff">The crypto tracker</a><br><a href="#events" style="color:#fff">Upcoming founder events</a></td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#0d3b4f"><tr><td align="center" style="padding:16px;color:#fff;font-size:14px;line-height:1.6"><strong>BUILT FOR THE REGION</strong><br>English coverage for everyone, with a Kiswahili summary for readers who opt in.</td></tr></table>
    <a id="big-tech" name="big-tech"></a><h2>BIG TECH</h2><h3>Microsoft closes a window in Nairobi</h3><img src="https://aztechafrica.site/dar-es-salaam-hero.png" alt="East African city connected by digital infrastructure" width="592" style="display:block;width:100%;height:auto"><p style="color:#aaa;font-size:12px">Image: AzTech Africa</p><p>Microsoft is winding down its Africa Development Centre in Nairobi after seven years, putting hundreds of roles and a significant pool of local engineering experience in focus.</p><p><strong>What happened?</strong> Employees were asked to discuss exit options. The final impact has not been fully disclosed.</p><p><strong>Why are they doing this?</strong> Microsoft describes the move as part of a global restructuring while saying it remains committed to Kenya.</p><p><strong>Explain it simply:</strong> the centre was built to let African engineers create products for global markets. Its future now depends on where that work and talent move next.</p><p><strong>The timeline:</strong> Nairobi opened in 2019; Microsoft later reduced roles across the region; the company is now considering a further wind-down.</p><p><a href="https://x.com" style="color:#ff806b">Share on X</a> · <a href="https://linkedin.com" style="color:#ff806b">LinkedIn</a> · <a href="https://wa.me/?text=AzTech%20Africa" style="color:#ff806b">WhatsApp</a></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border:1px solid #1d5773"><tr><td align="center" style="padding:12px;background:#123a58;color:#83c4e4;font-size:12px;font-weight:bold">THE AZTECH READ</td></tr><tr><td align="center" style="padding:16px;background:#e7f4fa;color:#0b1f38"><img src="https://aztechafrica.site/aztech-africa-map.png" alt="AzTech Africa map mark" width="120" style="display:block;width:120px;height:auto;margin:6px auto 12px"><strong style="font-size:17px">Local context. Regional perspective.</strong><br><span style="font-size:14px;line-height:1.5">Signals that help founders and operators see what is changing and why it matters.</span></td></tr></table>
    <a id="fintech" name="fintech"></a><h2>FINTECH</h2><h3>Wise builds its South African foothold</h3><p>South Africa's Reserve Bank has appointed Wise Payments South Africa as a Category Two Authorised Dealer in foreign exchange, giving the company a clearer local regulatory footing.</p><p><strong>Why it matters:</strong> the licence supports certain foreign-exchange transactions. Customers should check service terms and current limits before moving funds.</p>
    <a id="companies" name="companies"></a><h2>COMPANIES</h2><h3>iOCO's profit jumps 39%, but growth still needs work</h3><p>A stronger bottom line is one signal. The next question is whether the business can turn it into durable growth and better customer outcomes.</p>
    <a id="crypto" name="crypto"></a><h2>CRYPTO TRACKER</h2><p>The World Wide Web3 · Source: CoinMarketCap</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;color:#eee;font-size:13px"><tr><th align="left">Coin</th><th align="left">Value</th><th align="left">Day</th><th align="left">Month</th></tr><tr><td>Bitcoin</td><td>$83,539</td><td style="color:#ff7b70">-0.15%</td><td style="color:#75d995">+7.87%</td></tr><tr><td>Ether</td><td>$2,502</td><td style="color:#ff7b70">-0.80%</td><td style="color:#ff7b70">-0.28%</td></tr><tr><td>Bitway</td><td>$2.68</td><td style="color:#75d995">+48.88%</td><td style="color:#75d995">+257.46%</td></tr><tr><td>Solana</td><td>$107.29</td><td style="color:#ff7b70">-0.74%</td><td style="color:#75d995">+6.20%</td></tr></table><p><em>Data as of 06:37 AM WAT, October 14, 2026.</em></p>
    <a id="events" name="events"></a><h2>EVENTS</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:14px;background:#103d48;color:#eee"><strong>Seed G3 · Lagos · October 14-15</strong><br>Two days on building resilient ventures. <a href="https://aztechafrica.site/#partners" style="color:#ff806b">Event details</a></td></tr><tr><td style="padding:14px;background:#123a58;color:#eee"><strong>OffChart NXT · Port Harcourt · October 22-23</strong><br>Founders, investors, and policymakers meet to build new markets. <a href="https://aztechafrica.site/#partners" style="color:#ff806b">Event details</a></td></tr><tr><td style="padding:14px;background:#153852;color:#eee"><strong>Moonshot · Lagos · October 28-29</strong><br>Courage and conviction for a new world. <a href="https://aztechafrica.site/#partners" style="color:#ff806b">Get your ticket</a></td></tr><tr><td style="padding:14px;background:#0b1f38;color:#eee"><strong>Defence Futures Summit · Abuja · October 14-15</strong><br>Local innovation for national security. <a href="https://aztechafrica.site/#partners" style="color:#ff806b">Event details</a></td></tr></table>
    <h2>IN OTHER NEWS</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#392d30"><tr><td style="padding:14px;color:#eee;line-height:1.8">&bull; <a href="https://aztechafrica.site/#featured-articles" style="color:#fff">West Africa's new mobile money rules could reshape deposits</a><br>&bull; <a href="https://aztechafrica.site/#featured-articles" style="color:#fff">A boardroom battle tests a regional bitcoin company</a><br>&bull; <a href="https://aztechafrica.site/#featured-articles" style="color:#fff">Researchers build a neural network that runs on light</a></td></tr></table>
    <p><strong>Written by:</strong> AzTech Africa newsroom<br><strong>Edited by:</strong> Editorial desk</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1c2a23"><tr><td align="center" style="padding:20px;color:#eee"><strong>Want more of AzTech Africa?</strong><br>Get clear reporting on technology shaping East Africa.<br><a href="https://aztechafrica.site/#newsletter-section" style="color:#ff806b">Explore our newsletters</a></td></tr></table><p style="padding:12px;background:#e84a20;color:#fff"><strong>ADVERTISE WITH AZTECH AFRICA</strong><br>Reach founders, investors, and technology leaders across East Africa.</p>
  `;
  const languageStart = content.lastIndexOf('<table', content.indexOf('KISWAHILI SUMMARY AVAILABLE'));
  const languageEnd = content.indexOf('</table>', languageStart) + '</table>'.length;
  if (languageStart >= 0 && languageEnd >= '</table>'.length) content = `${content.slice(0, languageStart)}<!-- AZTECH_LANGUAGE_STATUS -->${content.slice(languageEnd)}`;
  const tocHeadline = content.indexOf("THIS WEEK'S SIGNALS");
  if (tocHeadline >= 0) {
    const tocStart = content.lastIndexOf('<table', tocHeadline);
    const tocEnd = content.indexOf('</table>', tocHeadline) + '</table>'.length;
    if (tocStart >= 0 && tocEnd >= '</table>'.length) content = `${content.slice(0, tocStart)}<!-- AZTECH_TABLE_OF_CONTENTS -->${content.slice(tocEnd)}`;
  }
  const storyStart = content.indexOf('    <a id="big-tech"');
  const writerStart = content.indexOf('    <p><strong>Written by:', storyStart);
  return storyStart >= 0 && writerStart > storyStart
    ? `${content.slice(0, storyStart)}    <!-- AZTECH_STORY_BLOCKS -->\n    <!-- AZTECH_SPONSOR_BLOCKS -->\n${content.slice(writerStart)}`
    : content;
}

export function buildEmailHtml(body, subject, { segment = 'founders', issueType = 'decision-ready', preheader = '', postalAddress = '', swahiliBody = '', previewSwahili = false, stories = [], sponsoredCards = [] } = {}) {
  const starterContent = (body || '').trim() || buildNewsletterStarterContent();
  const swahiliContent = (swahiliBody || '').trim();
  const storyBlocks = buildStoryBlocks(stories);
  const sponsorBlocks = buildSponsorBlocks(sponsoredCards);
  const hasDynamicSlots = starterContent.includes('<!-- AZTECH_STORY_BLOCKS -->') || starterContent.includes('<!-- AZTECH_SPONSOR_BLOCKS -->');
   const englishContent = starterContent
    .replace('<!-- AZTECH_TABLE_OF_CONTENTS -->', buildStoryTableOfContents(stories))
    .replace('<!-- AZTECH_LANGUAGE_STATUS -->', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#123a58"><tr><td colspan="2" style="padding:12px;color:#fff;font-size:12px;font-weight:bold">ENGLISH EDITION${swahiliContent ? ` · KISWAHILI SUMMARY ${previewSwahili ? 'INCLUDED' : 'AVAILABLE FOR OPT-IN'}` : ''}</td></tr></table>`)
    .replace('<!-- AZTECH_STORY_BLOCKS -->', storyBlocks)
    .replace('<!-- AZTECH_SPONSOR_BLOCKS -->', sponsorBlocks);
  const partnerContent = hasDynamicSlots ? '' : `${storyBlocks}${sponsorBlocks}`;
  const preheaderHtml = preheader.trim() ? `<div style="display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader.trim())}</div>` : '';
  const editionDate = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
  const readOnlineUrl = `${window.location.origin}/`;
  const footerAddress = postalAddress.trim() ? escapeHtml(postalAddress.trim()) : "Add AzTech Africa's verified postal mailing address before sending.";
  const content = previewSwahili && swahiliContent
    ? `${englishContent}<hr style="margin:22px 0;border:0;border-top:1px solid #d6e2ec"><div lang="sw"><p style="margin:0 0 10px;color:#1478a5;font-size:10px;font-weight:bold;letter-spacing:1px">TOLEO LA KISWAHILI</p>${swahiliContent}</div>${partnerContent}`
    : swahiliContent
      ? `${englishContent}{{ if .Subscriber.Attribs.swahiliSummary }}<hr style="margin:22px 0;border:0;border-top:1px solid #d6e2ec"><div lang="sw"><p style="margin:0 0 10px;color:#1478a5;font-size:10px;font-weight:bold;letter-spacing:1px">TOLEO LA KISWAHILI</p>${swahiliContent}</div>{{ end }}${partnerContent}`
      : `${englishContent}${partnerContent}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject || 'AzTech Africa Weekly Brief')}</title>
  <style>
    body{margin:0;background:#06182a;color:#eaf4f8;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%}
    .outer{width:100%;padding:20px 12px;background:#06182a}
    .email{width:100%;max-width:640px;margin:0 auto;background:#0b1f38}
    .pad{padding:28px 32px}
    .masthead{font-size:17px;font-weight:bold;letter-spacing:.5px;color:#f5f5f5}
    .headline{font-size:32px;line-height:1.2}
    .content{color:#eaf4f8;font-size:16px;line-height:1.65}
    .content p,.content li{color:#eaf4f8!important;font-size:16px!important;line-height:1.7!important}
    .content h2,.content h3{color:#f4fbff!important;font-family:Arial,Helvetica,sans-serif!important;font-size:22px!important;line-height:1.3!important}
    .content>h2,.content h2{padding-top:18px;border-top:2px solid #00a3e0;font-family:Georgia,'Times New Roman',serif!important;color:#83c4e4!important;font-size:22px!important}
    .content a{color:#ff8a4c!important;text-decoration:underline}
    .content strong{color:#fff!important}
    .content blockquote{border-left-color:#f06424!important;background:#123a58!important;color:#eaf4f8!important}
    .content td{border-color:#1d4965!important}
    .content hr{border-top-color:#1d4965!important}
    .content td[style*="background:#f0eaff"]{background:#e7f4fa!important;color:#0b1f38!important}
    .footer{background:#06182a;color:#eaf4f8}
    @media(max-width:480px){.outer{padding:0}.pad{padding:24px 22px}.headline{font-size:27px!important}.content p,.content li{font-size:17px!important;line-height:1.7!important}.content h2,.content h3{font-size:22px!important}}
  </style>
</head>
<body bgcolor="#06182a">
  <table class="outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#06182a">
    <tr><td align="center">
      <table class="email" role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b1f38">
        <tr><td class="pad" bgcolor="#0b1f38" style="background:#0b1f38;color:#f5f5f5;border-bottom:5px solid #f06424">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;color:#c9c9c9;font-size:13px"><tr><td>${editionDate}</td><td align="right"><a href="${escapeHtml(readOnlineUrl)}" style="color:#ff806b">Read online</a></td></tr></table>
          <div class="masthead">AZTECH <span style="color:#f06424">AFRICA</span></div>
          <p style="margin:24px 0 8px;color:#00a3e0;font-size:13px;font-weight:bold;letter-spacing:1px">THE WEEKLY INTELLIGENCE BRIEF</p>
          <h1 class="headline" style="margin:0;color:#fff;font-size:32px;line-height:1.2">${escapeHtml(subject || 'The Pulse of Silicon Dar')}</h1>
          <p style="margin:14px 0 0;color:#d4d4d4;font-size:15px;line-height:1.6">Decision-ready editorial coverage for ${escapeHtml(segment === 'regional' ? 'East African readers' : segment === 'investors' ? 'investors and ecosystem builders' : segment === 'policy' ? 'policy and regulatory watchers' : 'founders and operators')}</p>
        </td></tr>
        <tr><td class="pad content" bgcolor="#0b1f38" style="background:#0b1f38;padding-top:30px;padding-bottom:34px;color:#eaf4f8">${preheaderHtml}${content}</td></tr>
        <tr><td class="pad footer" bgcolor="#06182a" style="background:#06182a;border-top:3px solid #00a3e0;color:#eaf4f8;font-size:14px;line-height:1.7">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f06424;color:#0b1f38;text-align:center"><tr><td style="padding:12px"><a href="https://x.com" style="color:#0b1f38;font-size:17px;font-weight:bold;text-decoration:none">X</a></td><td style="padding:12px"><a href="https://linkedin.com" style="color:#0b1f38;font-size:17px;font-weight:bold;text-decoration:none">in</a></td><td style="padding:12px"><a href="https://wa.me/?text=AzTech%20Africa" style="color:#0b1f38;font-size:17px;font-weight:bold;text-decoration:none">WhatsApp</a></td></tr></table>
          <div align="center"><strong style="color:#fff">AzTech Africa</strong><br>Independent intelligence from Silicon Dar and East African tech.<br><a href="{{ UnsubscribeURL }}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#f06424;color:#0b1f38;font-weight:bold;text-decoration:none">Unsubscribe</a><br><span style="display:inline-block;margin-top:12px;color:#83c4e4;font-size:12px">${footerAddress}</span><br><span style="color:#83c4e4;font-size:11px">Newsletter preferences and subscription details</span></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}

export default function NewsletterCampaigns({ ownerEmail = '' }) {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [campaign, setCampaign] = useState(emptyCampaign);
  const [editingCampaignId, setEditingCampaignId] = useState('');
  const [editingCampaignStatus, setEditingCampaignStatus] = useState('');
  const [campaignBodyIsRaw, setCampaignBodyIsRaw] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [previewDevice, setPreviewDevice] = useState('mobile');
  const [editingLanguage, setEditingLanguage] = useState('en');
  const [previewLanguage, setPreviewLanguage] = useState('bilingual');
  const [publishedStories, setPublishedStories] = useState([]);
  const [sponsoredCards, setSponsoredCards] = useState([]);
  const [selectedStoryIds, setSelectedStoryIds] = useState([]);
  const [selectedSponsorKeys, setSelectedSponsorKeys] = useState([]);
  const englishBodyEditor = useRef(null);
  const swahiliBodyEditor = useRef(null);
  const newsletterLinkSelection = useRef({ language: 'en', start: 0, end: 0 });
  const [newsletterLinkComposerOpen, setNewsletterLinkComposerOpen] = useState(false);
  const [newsletterLinkDraft, setNewsletterLinkDraft] = useState({ text: '', url: '' });

  async function refresh() {
    const result = await request('/api/admin/newsletter');
    setDashboard(result);
    setCampaign((current) => ({ ...current, listId: current.listId || String(result.lists[0]?.id || '') }));
    return result;
  }

  function startNewCampaign() {
    if (editingCampaignId && !window.confirm('Discard unsaved changes to this newsletter and start a new campaign?')) return;
    setEditingCampaignId('');
    setEditingCampaignStatus('');
    setCampaignBodyIsRaw(false);
    setCampaign(emptyCampaign);
    setTestEmail('');
    setEditingLanguage('en');
    setPreviewLanguage('bilingual');
    setMessage('');
    requestAnimationFrame(() => document.querySelector('.campaign-create')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function editCampaign(item) {
    setBusy(`edit-${item.id}`);
    setMessage('');
    try {
      const existing = await request(`/api/admin/newsletter/campaigns/${encodeURIComponent(item.id)}`);
      setEditingCampaignId(String(existing.id));
      setEditingCampaignStatus(existing.status || 'draft');
      setCampaignBodyIsRaw(true);
      setCampaign({
        ...emptyCampaign,
        name: existing.name || '',
        subject: existing.subject || '',
        body: existing.body || '',
        listId: String(existing.lists?.[0]?.id ?? existing.lists?.[0] ?? ''),
        fromEmail: existing.from_email || '',
        sendAt: formatDateTimeInput(existing.send_at),
      });
      setTestEmail('');
      setEditingLanguage('en');
      setPreviewLanguage('english');
      setMessage('Existing newsletter loaded. Edit its HTML, save changes, and send a fresh test before sending.');
      requestAnimationFrame(() => document.querySelector('.campaign-create')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message)).finally(() => setLoading(false));
    Promise.all([fetch('/api/articles'), fetch('/api/site-settings')])
      .then(async ([articlesResponse, settingsResponse]) => {
        if (!articlesResponse.ok || !settingsResponse.ok) throw new Error('Could not load newsletter images and sponsored cards.');
        const [articles, settings] = await Promise.all([articlesResponse.json(), settingsResponse.json()]);
        const liveStories = articles.filter((story) => !story.status || story.status === 'published');
        const activeCards = (settings.newsletterAds || []).filter((card) => card.active);
        setPublishedStories(liveStories);
        setSponsoredCards(activeCards);
        const handoff = JSON.parse(localStorage.getItem('aztech-newsletter-campaign-handoff') || 'null');
        const validStoryIds = new Set(liveStories.map((story) => String(story.id)));
        const validSponsorKeys = new Set(activeCards.map(sponsoredCardKey));
        const incomingStoryIds = Array.isArray(handoff?.storyIds) ? handoff.storyIds.map(String).filter((id) => validStoryIds.has(id)).slice(0, 3) : [];
        const incomingSponsorKeys = Array.isArray(handoff?.sponsorKeys) ? handoff.sponsorKeys.filter((key) => validSponsorKeys.has(key)) : [];
        setSelectedStoryIds(Array.isArray(handoff?.storyIds) ? incomingStoryIds : liveStories.filter((story) => story.imageUrl && story.category !== 'archive').slice(0, 3).map((story) => String(story.id)));
        setSelectedSponsorKeys(Array.isArray(handoff?.sponsorKeys) ? incomingSponsorKeys : activeCards.map(sponsoredCardKey));
        if (handoff) {
          setCampaign((current) => ({ ...current, name: handoff.name || current.name, subject: handoff.subject || current.subject, preheader: handoff.preheader || '', postalAddress: handoff.postalAddress || '', body: handoff.body || current.body, swahiliBody: handoff.swahiliBody || '', listId: current.listId || String(handoff.listId || '') }));
          setTestEmail(handoff.testEmail || '');
          setMessage('Preview draft loaded. Select a mailing list, verify the issue, then save or send a test.');
          localStorage.removeItem('aztech-newsletter-campaign-handoff');
        }
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const newsletterStories = publishedStories.filter((story) => selectedStoryIds.includes(story.id)).slice(0, 3);
  const newsletterAds = sponsoredCards.filter((card) => selectedSponsorKeys.includes(sponsoredCardKey(card)));

  async function syncAudience() {
    if (!campaign.listId) return;
    setBusy('sync');
    setMessage('');
    try {
      const result = await request('/api/admin/newsletter/sync', { method: 'POST', body: JSON.stringify({ listId: campaign.listId }) });
      setMessage(`Audience synced: ${result.created} added, ${result.updated} updated, ${result.unsubscribed} unsubscribed, ${result.skipped} skipped.`);
      await refresh();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  }

  async function setupAudience() {
    setBusy('setup');
    setMessage('');
    try {
      const result = await request('/api/admin/newsletter/setup-audience', { method: 'POST', body: '{}' });
      await refresh();
      setCampaign((current) => ({ ...current, listId: String(result.list.id) }));
      const action = result.created ? 'Created the private weekly list' : 'Reused the private weekly list';
      setMessage(`${action} and synced audience: ${result.sync.created} added, ${result.sync.updated} updated, ${result.sync.unsubscribed} unsubscribed, ${result.sync.skipped} skipped.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  }

  async function createCampaign(event) {
    event.preventDefault();
    const action = event.nativeEvent.submitter?.value || 'draft';
    const sendTestAfterSave = action === 'send-test';
    const sendNow = action === 'send-now';
    const schedule = action === 'schedule';
    const keepSchedule = editingCampaignStatus === 'scheduled' && !sendNow && action !== 'draft';
    if (!campaign.listId) {
      setMessage('Add an active Listmonk list before saving or sending this campaign.');
      return;
    }
    if (sendTestAfterSave && !testEmail.trim()) {
      setMessage('Enter a test recipient email first.');
      return;
    }
    const shouldSchedule = schedule || keepSchedule;
    const sendAt = shouldSchedule && campaign.sendAt ? new Date(campaign.sendAt) : null;
    if (shouldSchedule && (!sendAt || Number.isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now())) {
      setMessage('Choose a future date and time before scheduling this campaign.');
      return;
    }
    if (sendNow && !window.confirm(`Send “${campaign.name || campaign.subject || 'this campaign'}” to its full mailing list now? The audience will be synchronized first.`)) return;
    if (schedule && !window.confirm(`Schedule “${campaign.name || campaign.subject || 'this campaign'}” for ${sendAt.toLocaleString()}?`)) return;
    setBusy('create');
    setMessage('');
    const wasEditing = Boolean(editingCampaignId);
    const subject = campaignBodyIsRaw
      ? campaign.subject.trim()
      : campaign.swahiliSubject.trim()
        ? `${campaign.subject.trim()}{{ if .Subscriber.Attribs.swahiliSummary }} / ${campaign.swahiliSubject.trim()}{{ end }}`
        : campaign.subject.trim();
    const body = campaignBodyIsRaw ? campaign.body : buildEmailHtml(campaign.body, campaign.subject, { segment: campaign.segment, issueType: campaign.issueType, preheader: campaign.preheader, postalAddress: campaign.postalAddress, swahiliBody: campaign.swahiliBody, stories: newsletterStories, sponsoredCards: newsletterAds });
    const payload = { ...campaign, subject, body, sendAt: shouldSchedule ? sendAt.toISOString() : '' };
    try {
      const savedCampaign = await request(editingCampaignId ? `/api/admin/newsletter/campaigns/${encodeURIComponent(editingCampaignId)}` : '/api/admin/newsletter/campaigns', {
        method: editingCampaignId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setEditingCampaignId(String(savedCampaign.id));
      setEditingCampaignStatus(savedCampaign.status || (shouldSchedule ? 'scheduled' : 'draft'));
      await refresh();
      if (sendTestAfterSave) {
        try {
          await request(`/api/admin/newsletter/campaigns/${encodeURIComponent(savedCampaign.id)}/test`, { method: 'POST', body: JSON.stringify({ email: testEmail }) });
          setMessage(`Draft saved and test email sent to ${testEmail}.`);
        } catch (error) {
          setMessage(`Draft saved, but the test email failed: ${error.message}`);
        }
      } else if (sendNow) {
        try {
          const started = await request(`/api/admin/newsletter/campaigns/${encodeURIComponent(savedCampaign.id)}/send`, { method: 'POST', body: '{}' });
          setEditingCampaignStatus(started.status || 'running');
          setMessage('Campaign sent to its synchronized mailing list.');
          await refresh();
        } catch (error) {
          setMessage(`Campaign saved, but sending failed: ${error.message}`);
        }
      } else if (schedule) {
        setMessage(`Campaign scheduled for ${sendAt.toLocaleString()}.`);
      } else {
        setMessage(wasEditing ? 'Campaign changes saved as a draft.' : 'Campaign saved as a draft. Use the Kiswahili summary toggle for subscribers who opted in.');
      }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  }

  function insertBlock(block, language = editingLanguage) {
    const bodyKey = language === 'sw' ? 'swahiliBody' : 'body';
    const editor = (language === 'sw' ? swahiliBodyEditor : englishBodyEditor).current;
    const currentBody = campaign[bodyKey];
    const start = editor?.selectionStart ?? currentBody.length;
    const end = editor?.selectionEnd ?? currentBody.length;
    setCampaign((current) => ({ ...current, [bodyKey]: `${current[bodyKey].slice(0, start)}${block}${current[bodyKey].slice(end)}` }));
    requestAnimationFrame(() => {
      editor?.focus();
      editor?.setSelectionRange(start + block.length, start + block.length);
    });
  }

  function openNewsletterLinkComposer() {
    const language = editingLanguage;
    const bodyKey = language === 'sw' ? 'swahiliBody' : 'body';
    const editor = (language === 'sw' ? swahiliBodyEditor : englishBodyEditor).current;
    const currentBody = campaign[bodyKey];
    const start = editor?.selectionStart ?? currentBody.length;
    const end = editor?.selectionEnd ?? currentBody.length;
    newsletterLinkSelection.current = { language, start, end };
    setNewsletterLinkDraft({ text: editor?.value.slice(start, end).trim() || '', url: '' });
    setNewsletterLinkComposerOpen(true);
  }

  function saveNewsletterLink() {
    let url;
    try { url = new URL(newsletterLinkDraft.url.trim()); } catch {}
    if (!url || !['http:', 'https:'].includes(url.protocol)) {
      setMessage('Enter a full http:// or https:// link destination.');
      return;
    }
    const linkText = newsletterLinkDraft.text.trim();
    if (!linkText) return;
    const { language, start, end } = newsletterLinkSelection.current;
    const bodyKey = language === 'sw' ? 'swahiliBody' : 'body';
    const editor = (language === 'sw' ? swahiliBodyEditor : englishBodyEditor).current;
    const currentBody = campaign[bodyKey];
    const anchor = `<a href="${escapeHtml(url.href)}" style="color:#ff8a4c;text-decoration:underline">${escapeHtml(linkText)}</a>`;
    setCampaign((current) => ({ ...current, [bodyKey]: `${current[bodyKey].slice(0, start)}${anchor}${current[bodyKey].slice(end)}` }));
    setNewsletterLinkComposerOpen(false);
    requestAnimationFrame(() => {
      editor?.focus();
      editor?.setSelectionRange(start + anchor.length, start + anchor.length);
    });
  }

  function insertDecisionBriefTemplate() {
    const template = editingLanguage === 'sw' ? emptyCampaign.swahiliBody : buildNewsletterStarterContent();
    insertBlock(template, editingLanguage);
    setMessage(editingLanguage === 'sw' ? 'Inserted the Kiswahili weekly issue structure.' : 'Inserted the East African decision-ready issue template.');
  }

  async function sendTest(campaignId) {
    if (!testEmail.trim()) {
      setMessage('Enter a test recipient email first.');
      return;
    }
    setBusy(`test-${campaignId}`);
    setMessage('');
    try {
      await request(`/api/admin/newsletter/campaigns/${encodeURIComponent(campaignId)}/test`, { method: 'POST', body: JSON.stringify({ email: testEmail }) });
      setMessage(`Test email sent to ${testEmail}.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  }

  async function sendCampaign(campaignItem) {
    const name = campaignItem.name || campaignItem.subject || 'this campaign';
    if (!window.confirm(`Send “${name}” to its full mailing list? The audience will be synchronized first.`)) return;
    setBusy(`send-${campaignItem.id}`);
    setMessage('');
    try {
      await request(`/api/admin/newsletter/campaigns/${encodeURIComponent(campaignItem.id)}/send`, { method: 'POST', body: '{}' });
      setMessage('Campaign started.');
      await refresh();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  }

  if (loading) return <section className="campaigns-workspace"><p>Loading newsletter campaigns...</p></section>;

  return <section className="campaigns-workspace">
    {!dashboard.configured && <div className="campaigns-service-notice" role="status"><strong>Mailing service not connected</strong><span>Story selection and preview are available now. Connect Listmonk to save or send campaigns.</span></div>}
    <div className="campaigns-summary"><div><span>CONFIRMED AUDIENCE</span><strong>{dashboard.activeSubscriberCount.toLocaleString()}</strong></div><div><span>ACTIVE LISTS</span><strong>{dashboard.lists.length}</strong></div>{dashboard.lists.length ? <button className="studio-secondary" disabled={busy !== '' || !campaign.listId} onClick={syncAudience} type="button">{busy === 'sync' ? 'Syncing...' : 'Sync audience'}</button> : <button className="studio-secondary" disabled={busy !== ''} onClick={setupAudience} type="button">{busy === 'setup' ? 'Setting up list...' : 'Create private list & sync'}</button>}</div>

    <section className="campaign-list-section"><div className="campaign-section-heading"><div><span>EXISTING NEWSLETTERS</span><h3>Review and send</h3></div><button className="studio-secondary" disabled={busy !== ''} onClick={startNewCampaign} type="button">New campaign</button></div>
      <div className="campaign-history-controls">{ownerEmail && <p className="campaign-owner-note">Managed by {ownerEmail}</p>}<label>Test recipient<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="editor@example.com" /></label></div>
      {dashboard.campaigns.length ? <div className="campaign-list">{dashboard.campaigns.map((item) => <article className="campaign-row" key={item.id}><div className="campaign-row-main"><strong>{item.name || item.subject}</strong><span>{item.subject}</span></div><div className="campaign-row-meta"><span className={`campaign-status campaign-status-${item.status}`}>{item.status}</span><time>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</time></div><div className="campaign-row-actions">{['draft', 'scheduled'].includes(item.status) && <button className="studio-secondary" disabled={busy !== ''} onClick={() => editCampaign(item)} type="button">{busy === `edit-${item.id}` ? 'Loading...' : item.status === 'scheduled' ? 'Edit schedule' : 'Edit draft'}</button>}<button className="studio-secondary" disabled={busy !== ''} onClick={() => sendTest(item.id)} type="button">{busy === `test-${item.id}` ? 'Sending...' : 'Send test'}</button>{['draft', 'paused', 'scheduled'].includes(item.status) && <button className="button button-orange" disabled={busy !== ''} onClick={() => sendCampaign(item)} type="button">{busy === `send-${item.id}` ? 'Sending...' : 'Send now'}</button>}</div></article>)}</div> : <p className="campaigns-empty-copy">No newsletters yet. Create a new campaign below to get started.</p>}
    </section>

    <form className="campaign-create" onSubmit={createCampaign}>
      <div className="campaign-section-heading"><div><span>{editingCampaignId ? 'EDIT NEWSLETTER' : 'NEW CAMPAIGN'}</span><h3>{editingCampaignId ? 'Edit existing newsletter' : 'Compose an email'}</h3></div>{editingCampaignId && <button className="studio-secondary" disabled={busy !== ''} onClick={startNewCampaign} type="button">New campaign</button>}</div>
      {!dashboard.lists.length && <p className="campaigns-empty-copy">Preview and edit the issue below. Create the private audience list above before saving or sending so this briefing reaches the right readers.</p>}
        <div className="campaign-tools" style={{ display: 'grid', gap: '8px', marginBottom: '12px', padding: '12px 14px', background: '#f6fafb', border: '1px solid #dfeaf1', borderRadius: '6px' }}>
          <strong style={{ color: '#123557' }}>Editorial checklist</strong>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#526b82', lineHeight: 1.7 }}>
            <li>Pick the few stories that sharpen the week, not just everything that happened.</li>
            <li>Keep the issue calm, clear, and decision-ready for founders and operators.</li>
            <li>Use sponsor cards as support, not clutter; only active placements should appear.</li>
          </ul>
        </div>
        <div className="campaign-fields">
          <label>Campaign name<input value={campaign.name} onChange={(event) => setCampaign({ ...campaign, name: event.target.value })} maxLength="200" required /></label>
          <label>Mailing list<select value={campaign.listId} onChange={(event) => setCampaign({ ...campaign, listId: event.target.value })} disabled={!dashboard.lists.length} required={dashboard.lists.length > 0}>{dashboard.lists.length ? dashboard.lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>) : <option value="">No active lists</option>}</select></label>
          <label>From email<input type="text" value={campaign.fromEmail} onChange={(event) => setCampaign({ ...campaign, fromEmail: event.target.value })} placeholder="AzTech Africa <news@example.com>" /></label>
          <label>Test recipient<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="editor@example.com" /></label>
          <label>Schedule send<input type="datetime-local" min={formatDateTimeInput(new Date(Date.now() + 60_000).toISOString())} value={campaign.sendAt} onChange={(event) => setCampaign({ ...campaign, sendAt: event.target.value })} /></label>
          <label>Reader segment<select value={campaign.segment} onChange={(event) => setCampaign({ ...campaign, segment: event.target.value })}><option value="founders">Founders and operators</option><option value="investors">Investors and ecosystem builders</option><option value="policy">Policy and regulators</option><option value="regional">Regional readers</option></select></label>
          <label>Edition focus<select value={campaign.issueType} onChange={(event) => setCampaign({ ...campaign, issueType: event.target.value })}><option value="decision-ready">Decision-ready brief</option><option value="operator-alert">Operator alert</option><option value="investor-digest">Investor digest</option></select></label>
        </div>
        <div className="campaign-tools campaign-checklist" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input checked={campaign.sections.signals} onChange={(event) => setCampaign({ ...campaign, sections: { ...campaign.sections, signals: event.target.checked } })} type="checkbox" /><span>The week in 60 seconds</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input checked={campaign.sections.funding} onChange={(event) => setCampaign({ ...campaign, sections: { ...campaign.sections, funding: event.target.checked } })} type="checkbox" /><span>Funding &amp; deals</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input checked={campaign.sections.policy} onChange={(event) => setCampaign({ ...campaign, sections: { ...campaign.sections, policy: event.target.checked } })} type="checkbox" /><span>Policy watch</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input checked={campaign.sections.opportunities} onChange={(event) => setCampaign({ ...campaign, sections: { ...campaign.sections, opportunities: event.target.checked } })} type="checkbox" /><span>Opportunities &amp; events</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input checked={campaign.sections.operatorStory} onChange={(event) => setCampaign({ ...campaign, sections: { ...campaign.sections, operatorStory: event.target.checked } })} type="checkbox" /><span>Operator story</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input checked={campaign.sections.links} onChange={(event) => setCampaign({ ...campaign, sections: { ...campaign.sections, links: event.target.checked } })} type="checkbox" /><span>Useful links</span></label>
        </div>
        <div className="campaign-compose-grid">
          <fieldset className="campaign-source-picker"><legend>Published articles</legend><p>These stories load from Stories after publication. Choose up to three for this campaign.</p>
            {publishedStories.length ? publishedStories.map((story) => <label className={`campaign-story-option${selectedStoryIds.includes(story.id) ? ' selected' : ''}`} key={story.id}><input checked={selectedStoryIds.includes(story.id)} disabled={!selectedStoryIds.includes(story.id) && newsletterStories.length >= 3} onChange={(event) => setSelectedStoryIds((current) => event.target.checked ? [...current, story.id] : current.filter((id) => id !== story.id))} type="checkbox" /><span className="campaign-story-image">{story.imageUrl ? <img src={story.imageUrl} alt={story.imageAlt || ''} loading="lazy" /> : <span>{(story.category || 'story').slice(0, 1).toUpperCase()}</span>}</span><span className="campaign-story-copy"><strong>{story.cardTitle || story.title}</strong><small>{story.category === 'archive' ? 'Archive' : story.label || story.category}{story.imageUrl ? ' · Image ready' : ' · Text only'}</small><small>{story.description}</small></span></label>) : <p>No published articles are available yet. Publish a story in Stories to start shaping the next briefing.</p>}
            <button className="studio-text-action" onClick={() => window.dispatchEvent(new CustomEvent('editorial-studio-view', { detail: 'stories' }))} type="button">Open Stories to edit or publish</button>
          </fieldset>
          <fieldset className="campaign-source-picker"><legend>Sponsored placements</legend><p>Only active sponsor cards appear here, and only the ones you select become part of the final brief.</p>
            {sponsoredCards.length ? sponsoredCards.map((card) => <label key={sponsoredCardKey(card)}><input checked={selectedSponsorKeys.includes(sponsoredCardKey(card))} onChange={(event) => setSelectedSponsorKeys((current) => event.target.checked ? [...current, sponsoredCardKey(card)] : current.filter((key) => key !== sponsoredCardKey(card)))} type="checkbox" /><span><strong>{card.title}</strong><small>{card.sponsor} · Sponsored</small></span></label>) : <p>No active sponsor placements yet. Create or activate one in Site settings to support this issue.</p>}
            <button className="studio-text-action" onClick={() => window.dispatchEvent(new CustomEvent('editorial-studio-view', { detail: 'media' }))} type="button">Manage sponsored cards</button>
          </fieldset>
        </div>
        <div className="campaign-compose-grid">
          <div className="campaign-editor-pane">
            <div className="campaign-device-switch campaign-language-switch" aria-label="Newsletter language editor"><button aria-pressed={editingLanguage === 'en'} onClick={() => setEditingLanguage('en')} type="button">English</button><button aria-pressed={editingLanguage === 'sw'} onClick={() => setEditingLanguage('sw')} type="button">Kiswahili</button></div>
            <label>{editingLanguage === 'en' ? 'English subject line' : 'Kiswahili subject line'}<input value={editingLanguage === 'en' ? campaign.subject : campaign.swahiliSubject} onChange={(event) => setCampaign({ ...campaign, [editingLanguage === 'en' ? 'subject' : 'swahiliSubject']: event.target.value })} maxLength="200" required /></label>
            {editingLanguage === 'en' && <label>Inbox preview text<input value={campaign.preheader} onChange={(event) => setCampaign({ ...campaign, preheader: event.target.value })} maxLength="150" placeholder="Short text shown beside the subject in inboxes" /></label>}
            {editingLanguage === 'en' && <label>Publication postal address<input value={campaign.postalAddress} onChange={(event) => setCampaign({ ...campaign, postalAddress: event.target.value })} placeholder="Verified mailing address" /></label>}
            <label>{editingLanguage === 'en' ? 'English email content' : 'Kiswahili email content'}</label>
            <div className="campaign-tools"><button type="button" onClick={() => insertBlock('<h2 style="margin:22px 0 7px;color:#123557;font-size:19px;line-height:1.3">Section heading</h2>')}>Add heading</button><button type="button" onClick={() => insertBlock('<p style="margin:0 0 14px;color:#526b82;font-size:14px;line-height:1.65">Write your update here.</p>')}>Add paragraph</button><button type="button" onClick={() => insertBlock('<blockquote style="margin:16px 0;padding:12px 14px;border-left:3px solid #f06424;background:#f5f8fa;color:#43566b;font-size:14px;line-height:1.6">Key insight or quote</blockquote>')}>Add callout</button><button type="button" onClick={openNewsletterLinkComposer}>Insert link</button><button type="button" onClick={insertDecisionBriefTemplate}>Insert issue template</button></div>
            {newsletterLinkComposerOpen && <div className="newsletter-link-composer" role="group" aria-label="Insert newsletter link"><label>Link text<input value={newsletterLinkDraft.text} onChange={(event) => setNewsletterLinkDraft({ ...newsletterLinkDraft, text: event.target.value })} required /></label><label>Destination URL<input type="url" value={newsletterLinkDraft.url} onChange={(event) => setNewsletterLinkDraft({ ...newsletterLinkDraft, url: event.target.value })} placeholder="https://..." required /></label><button className="studio-secondary" onClick={saveNewsletterLink} type="button">Add link</button><button className="studio-secondary" onClick={() => setNewsletterLinkComposerOpen(false)} type="button">Cancel</button></div>}
            <textarea ref={editingLanguage === 'en' ? englishBodyEditor : swahiliBodyEditor} lang={editingLanguage === 'en' ? 'en' : 'sw'} rows="11" value={campaign[editingLanguage === 'en' ? 'body' : 'swahiliBody']} onChange={(event) => setCampaign({ ...campaign, [editingLanguage === 'en' ? 'body' : 'swahiliBody']: event.target.value })} placeholder={editingLanguage === 'en' ? 'Write the English newsletter HTML.' : 'Hariri hapa toleo la Kiswahili.'} required />
            <p className="campaign-language-note">English goes to everyone. The Kiswahili version is added for subscribers who opted in to the Swahili summary.</p>
            <p className="campaign-language-note">This draft includes {newsletterStories.length} selected published stories and {newsletterAds.length} sponsored cards. Story links open the public articles.</p>
          </div>
          <div className="campaign-preview-pane"><div className="campaign-preview-heading"><strong>Live email preview</strong><div className="campaign-device-switch" aria-label="Preview size"><button aria-pressed={previewDevice === 'desktop'} onClick={() => setPreviewDevice('desktop')} type="button">Desktop</button><button aria-pressed={previewDevice === 'mobile'} onClick={() => setPreviewDevice('mobile')} type="button">Mobile</button></div></div><div className="campaign-device-switch campaign-preview-language" aria-label="Preview language"><button aria-pressed={previewLanguage === 'english'} onClick={() => setPreviewLanguage('english')} type="button">English</button><button aria-pressed={previewLanguage === 'bilingual'} onClick={() => setPreviewLanguage('bilingual')} type="button">English + Kiswahili</button></div><div className="campaign-preview-frame"><iframe title={`${previewDevice} ${previewLanguage} newsletter preview`} sandbox="" srcDoc={campaignBodyIsRaw ? campaign.body : buildEmailHtml(campaign.body, previewLanguage === 'bilingual' && campaign.swahiliSubject ? `${campaign.subject} / ${campaign.swahiliSubject}` : campaign.subject, { segment: campaign.segment, issueType: campaign.issueType, preheader: campaign.preheader, postalAddress: campaign.postalAddress, swahiliBody: campaign.swahiliBody, previewSwahili: previewLanguage === 'bilingual', stories: newsletterStories, sponsoredCards: newsletterAds })} style={{ width: previewDevice === 'mobile' ? '375px' : '100%' }} /></div></div>
        </div>
        <div className="campaign-tools" style={{ display: 'grid', gap: '8px', marginTop: '14px' }}>
          <strong>Send workflow</strong>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#526b82', lineHeight: 1.7 }}>
            <li>Reusable issue template, internal test, audience check, final send.</li>
            <li>Trust markers: source, country, verified date, sponsorship label, plain-text alt copy.</li>
            <li>Track delivery, clicks, and unsubscribes by section for the next issue.</li>
          </ul>
        </div>
        <div className="campaign-tools" style={{ display: 'flex', flexWrap: 'wrap', gap: '9px' }}>
          <button className="button button-orange" disabled={busy !== '' || !campaign.listId} name="saveAction" type="submit" value="draft">{busy === 'create' ? 'Saving...' : editingCampaignStatus === 'scheduled' ? 'Save as draft' : editingCampaignId ? 'Save changes' : 'Save draft'}</button>
          <button className="studio-secondary" disabled={busy !== '' || !campaign.listId || !testEmail.trim()} name="saveAction" type="submit" value="send-test">{busy === 'create' ? 'Saving and sending...' : editingCampaignId ? 'Save changes & send test' : 'Save draft & send test'}</button>
          <button className="studio-secondary" disabled={busy !== '' || !campaign.listId || !campaign.sendAt} name="saveAction" type="submit" value="schedule">{busy === 'create' ? 'Scheduling...' : editingCampaignStatus === 'scheduled' ? 'Update schedule' : 'Schedule send'}</button>
          <button className="button button-orange" disabled={busy !== '' || !campaign.listId} name="saveAction" type="submit" value="send-now">{busy === 'create' ? 'Sending...' : 'Save & send now'}</button>
          {!dashboard.lists.length && <span className="campaign-language-note">Create the private list above before saving or testing.</span>}
        </div>
    </form>

    {message && <p className="studio-message" aria-live="polite">{message}</p>}
  </section>;
}