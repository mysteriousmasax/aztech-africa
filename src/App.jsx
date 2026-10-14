import { useEffect, useRef, useState } from 'react';
import NewsletterCampaigns from './NewsletterCampaigns.jsx';
import NewsletterCRM from './NewsletterCRM.jsx';
import WelcomeEmailSettings from './WelcomeEmailSettings.jsx';
import ImageUploadField from './ImageUploadField.jsx';
import AnalyticsDashboard from './AnalyticsDashboard.jsx';

const filters = [
  ['all', 'All Topics'],
  ['roundup', 'Weekly Roundup'],
  ['fintech', 'Fintech & Sandboxes'],
  ['community', 'Founder Voices'],
  ['investing', 'VC & Angel syndicates'],
  ['opportunity', 'Opportunities'],
  ['event', 'Events & Meetups'],
];
const defaultSiteSettings = {
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
};
const readerCountries = ['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Burundi', 'South Sudan', 'DR Congo'];
const readerInterests = [['fintech', 'Fintech'], ['agritech', 'AgriTech'], ['climate', 'Climate'], ['ai', 'AI'], ['policy', 'Policy'], ['funding', 'Funding'], ['opportunities', 'Opportunities'], ['events', 'Events']];

function sendAnalyticsEvent(event) {
  const payload = JSON.stringify(event);
  try {
    if (navigator.sendBeacon?.('/api/analytics/events', new Blob([payload], { type: 'application/json' }))) return;
  } catch {}
  fetch('/api/analytics/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
}

function Arrow({ size = 16 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>;
}

function AuthorAvatar({ author, className, alt = '' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (author?.displayName || 'A').slice(0, 1).toUpperCase();
  return <span className={className} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'}>
    {author?.avatarUrl && !imageFailed ? <img src={author.avatarUrl} alt="" onError={() => setImageFailed(true)} /> : <span>{initial}</span>}
  </span>;
}

function NetworkCanvas() {
  useEffect(() => {
    const canvas = document.getElementById('tech-canvas');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let nodes = [];

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      nodes = Array.from({ length: 38 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2 + 1.2,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      nodes.forEach((node, index) => {
        if (!reducedMotion) {
          node.x += node.vx;
          node.y += node.vy;
          if (node.x < 0 || node.x > width) node.vx *= -1;
          if (node.y < 0 || node.y > height) node.vy *= -1;
        }
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fillStyle = '#f06424';
        context.fill();
        nodes.slice(index + 1).forEach((other) => {
          const distance = Math.hypot(node.x - other.x, node.y - other.y);
          if (distance < 120) {
            context.beginPath();
            context.moveTo(node.x, node.y);
            context.lineTo(other.x, other.y);
            context.strokeStyle = `rgba(240, 100, 36, ${0.2 * (1 - distance / 120)})`;
            context.lineWidth = 0.8;
            context.stroke();
          }
        });
      });
      if (!reducedMotion) frame = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas aria-hidden="true" className="network-canvas" id="tech-canvas" />;
}

function HeroIllustration({ imageUrl, imageAlt }) {
  return (
    <div className="hero-art">
      <img className="landscape city-centre-image" src={imageUrl} alt={imageAlt} />
      <div className="art-caption"><span>Dar es Salaam · East African digital corridor</span><span>AzTech Africa concept artwork</span></div>
    </div>
  );
}

function SignupForm({ compact = false }) {
  const [email, setEmail] = useState('');
  const [swahiliSummary, setSwahiliSummary] = useState(false);
  const [country, setCountry] = useState('Tanzania');
  const [interests, setInterests] = useState([]);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onNewsletterLanguage = (event) => setSwahiliSummary(event.detail);
    window.addEventListener('newsletter-language', onNewsletterLanguage);
    return () => window.removeEventListener('newsletter-language', onNewsletterLanguage);
  }, []);

  async function submit(event) {
    event.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, swahiliSummary, country, interests, consent, source: compact ? 'hero' : 'newsletter' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not complete your subscription.');
      setStatus('success');
      setMessage(result.message);
      setEmail('');
      setConsent(false);
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'The subscription service is unavailable. Please try again.');
    }
  }

  return (
    <div className={compact ? 'signup-compact' : 'signup-panel'}>
      <form id={compact ? 'hero-signup-form' : 'main-newsletter-form'} className={compact ? 'signup-form compact-form' : 'signup-form'} onSubmit={submit}>
        <div className="signup-fields">
          <label className="sr-only" htmlFor={compact ? 'hero-email' : 'newsletter-email'}>Email address</label>
          <input id={compact ? 'hero-email' : 'newsletter-email'} type="email" autoComplete="email" placeholder={compact ? 'Enter your work email address...' : 'your.email@domain.com'} value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button className={compact ? 'button button-green signup-submit' : 'button button-orange signup-submit'} type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Joining...' : compact ? 'Get Weekly Intel' : 'Subscribe Now'} {compact && <Arrow size={15} />}
          </button>
        </div>
        <div className="form-options"><label><input checked={swahiliSummary} onChange={(event) => window.dispatchEvent(new CustomEvent('newsletter-language', { detail: event.target.checked }))} type="checkbox" /><span>Receive Swahili summary as well</span></label></div>
        <div className="reader-preferences">
          <label className="country-preference">Coverage country<select value={country} onChange={(event) => setCountry(event.target.value)}>{readerCountries.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <details><summary>Choose topics for your weekly brief</summary><div className="interest-options">{readerInterests.map(([value, label]) => <label key={value}><input checked={interests.includes(value)} onChange={(event) => setInterests((current) => event.target.checked ? [...current, value] : current.filter((interest) => interest !== value))} type="checkbox" /><span>{label}</span></label>)}</div></details>
        </div>
        <div className="form-options consent-row"><label><input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" required /><span>I agree to receive the AzTech Africa newsletter.</span></label></div>
        {status !== 'idle' && <p aria-live="polite" aria-atomic="true" className={`form-feedback ${status === 'error' ? 'error-feedback' : 'success-feedback'}`}>{status === 'loading' ? 'Submitting your subscription...' : message}</p>}
      </form>
      {compact && <p className="delivery-note"><span>✓ Friday edition</span><span>✓ Free to join</span></p>}
    </div>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const onSiteSearch = (event) => setQuery(event.detail || '');
    window.addEventListener('site-search', onSiteSearch);
    return () => window.removeEventListener('site-search', onSiteSearch);
  }, []);
  return (
    <>
      <header className="site-header"><div className="header-inner">
        <a className="brand" href="#top" aria-label="AzTech Africa home"><img className="brand-map" src="/aztech-africa-map.png" alt="" /><span className="brand-type"><strong>AZTECH</strong><span>AFRICA</span></span></a>
        <div className="header-actions"><label className="search-box"><span className="sr-only">Search reports and startups</span><input placeholder="Search reports, startups..." value={query} onChange={(event) => { setQuery(event.target.value); window.dispatchEvent(new CustomEvent('site-search', { detail: event.target.value })); }} /><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg></label><a className="button button-orange header-subscribe" href="#newsletter-section">Newsletter / Jarida</a><a className="staff-login-link" href="#studio" aria-label="Staff login" title="Staff login"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg><span>Staff login</span></a></div>
      </div></header>
    </>
  );
}

function Hero({ imageUrl, imageAlt }) {
  return <>
    <section className="hero" id="top"><NetworkCanvas /><div className="hero-glow" /><div className="hero-inner"><div className="hero-copy">
      <span className="hero-kicker"><span />Independent Intelligence from Silicon Dar</span>
      <h1>Silicon Dar<br /><span>&amp; East African Tech</span></h1>
      <p className="hero-subtitle">The Pulse of Silicon Dar &amp; East African Tech.</p>
      <div className="hero-signup"><a className="button button-orange hero-cta" href="#newsletter-section">Subscribe for Free / Jiunge na Jamii</a></div>
    </div><HeroIllustration imageUrl={imageUrl} imageAlt={imageAlt} /></div></section>
  </>;
}

function FilterBar({ active, onChange, country, countries, onCountryChange, search, onSearchChange, resultCount, onReset }) {
  return <section className="filter-bar" aria-label="Story discovery"><div className="filter-inner"><div className="filters"><span className="filter-label">Filter Intel:</span>{filters.map(([key, label]) => <button key={key} aria-pressed={active === key} className={active === key ? 'filter-button active' : 'filter-button'} type="button" onClick={() => onChange(key)}>{label}</button>)}</div><label className="country-filter"><span>Country</span><select value={country} onChange={(event) => onCountryChange(event.target.value)}><option value="all">All East Africa</option>{countries.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label className="mobile-search"><span className="sr-only">Search stories</span><input type="search" placeholder="Search stories, topics, countries..." value={search} onChange={(event) => onSearchChange(event.target.value)} /></label><div className="filter-summary" aria-live="polite"><span>{resultCount} {resultCount === 1 ? 'story' : 'stories'}</span><button type="button" onClick={onReset}>Clear filters</button></div><div className="updated-note"><span>◷</span> Updated Every Friday Morning (GMT+3)</div></div></section>;
}

function ArticleCard({ article, author, onOpenAuthor }) {
  const metadata = article.metadata || {};
  const details = article.category === 'opportunity'
    ? [['Type', metadata.opportunityType], ['Deadline', metadata.deadline], ['Location', metadata.location], ['Eligibility', metadata.eligibility]]
    : article.category === 'event'
      ? [['Date', metadata.startDate], ['Venue', metadata.venue], ['Audience', metadata.audience], ['Cost', metadata.cost]]
      : [];
  const visibleDetails = details.filter(([, value]) => value);
  const actionLabel = article.category === 'opportunity' ? 'View opportunity' : article.category === 'event' ? 'Event details' : 'Read more';

  return <article className={`article-card article-${article.category}`}>
    <a className="article-card-main" href={`/#story=${encodeURIComponent(article.id)}`} aria-label={`Read ${article.title}`}>
      {article.imageUrl && <img className="article-card-image" src={article.imageUrl} alt={article.imageAlt || ''} loading="lazy" />}
      <div><div className="article-meta"><span className={`article-label label-${article.category}`}>{article.label}</span><span>{article.readTime}</span></div><h2>{article.cardTitle}</h2><p>{article.description}</p>
        {visibleDetails.length > 0 && <dl className="structured-details">{visibleDetails.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}{metadata.verifiedAt && <span className="verification-note">Verified {metadata.verifiedAt}</span>}
      </div>
    </a>
    {author && <button className="article-card-author" onClick={() => onOpenAuthor(author)} type="button"><AuthorAvatar author={author} className="article-card-author-avatar" /><span>By <strong>{author.displayName || 'AzTech Africa contributor'}</strong></span></button>}
    <div className="article-footer"><a className="article-card-action" href={`/#story=${encodeURIComponent(article.id)}`}><span>{actionLabel}</span><Arrow size={14} /></a><span>{article.footer || 'Silicon Dar Dispatch'}</span></div>
  </article>;
}

function StructuredMetadataFields({ category, metadata = {}, onChange }) {
  if (!['opportunity', 'event'].includes(category)) return null;
  const opportunityFields = [
    ['opportunityType', 'Opportunity type', 'text'],
    ['organization', 'Organization', 'text'],
    ['amount', 'Value / amount', 'text'],
    ['deadline', 'Application deadline', 'date'],
    ['location', 'Location', 'text'],
    ['eligibility', 'Eligibility', 'text'],
    ['sourceUrl', 'Official source URL', 'url'],
    ['verifiedAt', 'Last verified', 'date'],
  ];
  const eventFields = [
    ['startDate', 'Start date', 'date'],
    ['endDate', 'End date', 'date'],
    ['venue', 'Venue or online link', 'text'],
    ['cost', 'Cost', 'text'],
    ['audience', 'Intended audience', 'text'],
    ['registrationUrl', 'Registration URL', 'url'],
    ['sourceUrl', 'Official source URL', 'url'],
    ['verifiedAt', 'Last verified', 'date'],
  ];
  const fields = category === 'opportunity' ? opportunityFields : eventFields;

  return <fieldset className="structured-fields"><legend>{category === 'opportunity' ? 'Opportunity details' : 'Event details'}</legend><div className="studio-fields">{fields.map(([key, label, type]) => <label key={key}>{label}<input type={type} value={metadata[key] || ''} onChange={(event) => onChange(key, event.target.value)} required={['deadline', 'sourceUrl', 'verifiedAt'].includes(key) && category === 'opportunity' || ['startDate', 'registrationUrl', 'sourceUrl', 'verifiedAt'].includes(key) && category === 'event'} /></label>)}</div></fieldset>;
}

function Featured({ articles, authors, onOpenAuthor, loading, onReset }) {
  return <section className="featured-section" id="featured-articles"><div className="content-width"><div className="section-heading"><span>THE LATEST INTELLIGENCE</span><h2>Stories shaping the region</h2></div>{loading ? <p className="loading-note">Loading the latest dispatches...</p> : articles.length ? <div className={articles.length >= 3 ? 'article-grid is-editorial-grid' : 'article-grid'}>{articles.map((article) => <ArticleCard key={article.id} article={article} author={authors.find((profile) => profile.storyIds.includes(article.id))} onOpenAuthor={onOpenAuthor} />)}</div> : <div className="empty-results"><h3>No current stories match those filters.</h3><p>Try another country or topic, or search past editions below.</p><button className="button button-orange" type="button" onClick={onReset}>Clear filters</button></div>}</div></section>;
}

function Partners() {
  return <section className="partners-section" id="partners"><div className="partners-inner"><span className="partners-title">TRUSTED BY</span><div className="partner-grid">
    <div className="partner"><span className="partner-symbol sahara">◉</span><span><strong>Sahara</strong><small>Ventures</small></span></div>
    <div className="partner"><span className="partner-symbol sban">S</span><span><strong>S-BAN</strong><small>Angels Network</small></span></div>
    <div className="partner"><span className="partner-symbol ict">▣</span><span><strong>ICT</strong><small>Commission</small></span></div>
    <div className="partner"><span className="partner-symbol silicon">&lt;/&gt;</span><span><strong>Silicon Dar</strong><small>Tech Hub</small></span></div>
  </div></div></section>;
}

function Metrics({ stories, countries, subscribers }) {
  const metrics = [[stories, 'Published stories', 'navy'], [countries, 'Countries covered', 'orange'], [subscribers, 'Confirmed subscribers', 'green']];
  return <section className="metrics-section" id="stats-section"><div className="content-width"><div className="metrics-intro"><span>Verified Editorial Activity</span><h2>Coverage you can explore</h2><p>Counts reflect published stories, their tagged country coverage, and confirmed newsletter subscriptions.</p></div><div className="metrics-grid">{metrics.map(([value, label, color]) => <div className="metric" key={label}><strong className={`metric-${color}`}>{value}</strong><span>{label}</span></div>)}</div></div></section>;
}

function Archive({ articles, onOpen }) {
  return <section className="archive-section" id="archive-section"><div className="content-width"><div className="archive-heading"><div><span>ARCHIVE</span><h2>Past Silicon Dar Dispatches</h2></div><p>Earlier issues are dated where publication dates are available.</p></div>{articles.length ? <div className="archive-grid">{articles.map((article) => <article className="archive-card" key={article.id}>{article.imageUrl && <img className="archive-card-image" src={article.imageUrl} alt={article.imageAlt || ''} loading="lazy" />}<span>{article.label}</span><h3>{article.cardTitle}</h3><details className="archive-preview"><summary>Preview this issue</summary><p>{article.description}</p></details><button type="button" onClick={() => onOpen(article)}>Read {article.tag.replace('Archive ', '')} →</button></article>)}</div> : <p className="empty-archive">No archive stories match the current search.</p>}</div></section>;
}

function SubscriptionManager({ token }) {
  const [subscriber, setSubscriber] = useState(null);
  const [swahiliSummary, setSwahiliSummary] = useState(false);
  const [country, setCountry] = useState('Tanzania');
  const [interests, setInterests] = useState([]);
  const [message, setMessage] = useState('Loading your preferences...');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/subscriptions/manage?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'This preference link is invalid.');
        return result;
      })
      .then((result) => {
        setSubscriber(result);
        setSwahiliSummary(result.swahiliSummary);
        setCountry(result.country || 'Tanzania');
        setInterests(result.interests || []);
        setMessage('');
      })
      .catch((error) => setMessage(error.message));
  }, [token]);

  async function updatePreferences(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/subscriptions/manage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, swahiliSummary, country, interests }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save preferences.');
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    if (!window.confirm('Unsubscribe this email from AzTech Africa?')) return;
    setBusy(true);
    try {
      const response = await fetch('/api/subscriptions/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to unsubscribe.');
      setSubscriber(null);
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="signup-panel subscription-manager"><h3>Newsletter preferences</h3>{subscriber && <><p>{subscriber.email}</p><form onSubmit={updatePreferences}><label className="country-preference">Coverage country<select value={country} onChange={(event) => setCountry(event.target.value)}>{readerCountries.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><fieldset className="interest-options"><legend>Topics</legend>{readerInterests.map(([value, label]) => <label key={value}><input checked={interests.includes(value)} onChange={(event) => setInterests((current) => event.target.checked ? [...current, value] : current.filter((interest) => interest !== value))} type="checkbox" /><span>{label}</span></label>)}</fieldset><label className="form-options preference-option"><input checked={swahiliSummary} onChange={(event) => setSwahiliSummary(event.target.checked)} type="checkbox" /><span>Receive Swahili summary as well</span></label><button className="button button-orange" disabled={busy} type="submit">Save preferences</button></form>{subscriber.status === 'active' && <button className="unsubscribe-button" disabled={busy} onClick={unsubscribe} type="button">Unsubscribe</button>}</>}{message && <p aria-live="polite" className="manage-message">{message}</p>}</div>;
}

function Newsletter() {
  const params = new URLSearchParams(window.location.search);
  const manageToken = params.get('manage');
  const subscriptionState = params.get('subscription');
  return <section className="newsletter-section" id="newsletter-section"><div className="newsletter-inner"><div className="newsletter-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 7 7.9 5.3a2 2 0 0 0 2.2 0L21 7M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" /></svg></div><h2>{manageToken ? 'Manage your subscription' : 'Subscribe for Free / Jiunge na Jamii'}</h2><p>{manageToken ? 'Update your newsletter preferences or unsubscribe.' : 'Join the AzTech Africa community for a weekly brief on East Africa&apos;s digital economy.'}</p>{subscriptionState === 'verified' && <p className="subscription-banner">Your email is confirmed. You’re subscribed to AzTech Africa.</p>}{subscriptionState === 'verification-invalid' && <p className="subscription-banner">That verification link is expired or already used. Submit your address again for a fresh link.</p>}{manageToken ? <SubscriptionManager token={manageToken} /> : <SignupForm />}</div></section>;
}

function EditorialStudio() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const workspaceMenuToggleRef = useRef(null);
  const workspaceDrawerCloseRef = useRef(null);
  const [message, setMessage] = useState('');
  const [stories, setStories] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const articleBodyEditor = useRef(null);
  const articleLinkSelection = useRef({ start: 0, end: 0 });
  const [articleLinkComposerOpen, setArticleLinkComposerOpen] = useState(false);
  const [articleLinkDraft, setArticleLinkDraft] = useState({ text: '', url: '' });
  const [preview, setPreview] = useState(false);
  const [studioView, setStudioView] = useState(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    return requestedView === 'newsletter' ? 'campaigns' : ['stories', 'media', 'crm', 'welcome', 'analytics'].includes(requestedView) ? requestedView : 'overview';
  });
  const [storyScope, setStoryScope] = useState('all');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [newUser, setNewUser] = useState({ email: '', role: 'author' });
  const [teamBusy, setTeamBusy] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState('');
  const [memberProfile, setMemberProfile] = useState({ displayName: '', title: '', bio: '', avatarUrl: '', xUrl: '', linkedInUrl: '', instagramUrl: '', facebookUrl: '', websiteUrl: '' });
  const [profileDraft, setProfileDraft] = useState({ displayName: '', title: '', bio: '', avatarUrl: '', xUrl: '', linkedInUrl: '', instagramUrl: '', facebookUrl: '', websiteUrl: '' });
  const [setupToken, setSetupToken] = useState(() => new URLSearchParams(window.location.search).get('setup') || '');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const [siteSettings, setSiteSettings] = useState(defaultSiteSettings);

  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
    const result = response.status === 204 ? {} : await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
  }

  async function refreshWorkspace(activeUser = user) {
    if (!activeUser) return;
    const articleList = await request('/api/editorial/articles');
    setStories(articleList);
    if (activeUser.role === 'admin') {
      const [team, settings] = await Promise.all([request('/api/admin/users'), request('/api/site-settings')]);
      setUsers(team);
      setSiteSettings(settings);
    }
  }

  useEffect(() => {
    request('/api/auth/me').then(({ user: sessionUser }) => {
      setUser(sessionUser);
      if (sessionUser) setProfileDraft({ displayName: sessionUser.displayName || '', title: sessionUser.title || '', bio: sessionUser.bio || '', avatarUrl: sessionUser.avatarUrl || '', xUrl: sessionUser.xUrl || '', linkedInUrl: sessionUser.linkedInUrl || '', instagramUrl: sessionUser.instagramUrl || '', facebookUrl: sessionUser.facebookUrl || '', websiteUrl: sessionUser.websiteUrl || '' });
      return sessionUser ? refreshWorkspace(sessionUser) : null;
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function openEditorialStudioView(event) {
      if (user && ['stories', 'media'].includes(event.detail)) {
        setStudioView(event.detail);
        setMobileNavOpen(false);
        window.scrollTo(0, 0);
      }
    }
    window.addEventListener('editorial-studio-view', openEditorialStudioView);
    return () => window.removeEventListener('editorial-studio-view', openEditorialStudioView);
  }, [user]);

  async function signIn(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const result = await request('/api/auth/login', { method: 'POST', body: JSON.stringify(login) });
      setUser(result.user);
      setProfileDraft({ displayName: result.user.displayName || '', title: result.user.title || '', bio: result.user.bio || '', avatarUrl: result.user.avatarUrl || '', xUrl: result.user.xUrl || '', linkedInUrl: result.user.linkedInUrl || '', instagramUrl: result.user.instagramUrl || '', facebookUrl: result.user.facebookUrl || '', websiteUrl: result.user.websiteUrl || '' });
      setStudioView('overview');
      setLogin({ email: '', password: '' });
      await refreshWorkspace(result.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await request('/api/auth/logout', { method: 'POST', body: '{}' });
    setUser(null);
    setStories([]);
    setUsers([]);
    setSelected(null);
    setStudioView('overview');
  }

  function beginStory(article = null) {
    const copyPublished = article?.status === 'published' && user.role !== 'admin';
    setSelected(article ? {
      ...article,
      id: copyPublished ? '' : article.id,
      slug: copyPublished ? '' : article.slug,
      status: copyPublished ? 'draft' : article.status,
      authorEmail: copyPublished ? user.email : article.authorEmail,
      reviewerNote: copyPublished ? null : article.reviewerNote,
      submittedAt: copyPublished ? null : article.submittedAt,
      publishedAt: copyPublished ? null : article.publishedAt,
      date: copyPublished ? 'Publication date pending' : article.date,
      metadata: article.metadata || {},
      imageUrl: article.imageUrl || '',
      imageAlt: article.imageAlt || '',
      countryText: (article.countries || []).join(', '),
      topicText: (article.topics || []).join(', '),
      bodyText: (article.content || []).map((block) => block.type === 'heading' ? `## ${block.text}` : block.type === 'list' ? block.items.map((item) => `- ${item}`).join('\n') : block.text).join('\n\n'),
    } : { category: 'roundup', title: '', cardTitle: '', label: 'Editorial', tag: 'Weekly Roundup', readTime: '5 min read', description: '', date: 'Publication date pending', footer: '', metadata: {}, imageUrl: '', imageAlt: '', countryText: 'Tanzania', topicText: '', bodyText: '' });
    setMessage(copyPublished ? 'Published story copied into a new draft. Save it to your stories to keep your edits.' : '');
    setPreview(false);
    setStudioView('stories');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function navigateWorkspace(view) {
    setStudioView(view);
    setMobileNavOpen(false);
    if (window.matchMedia('(max-width: 760px)').matches) requestAnimationFrame(() => workspaceMenuToggleRef.current?.focus());
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
        workspaceMenuToggleRef.current?.focus();
      }
    };
    const focusCloseButton = requestAnimationFrame(() => workspaceDrawerCloseRef.current?.focus());
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      cancelAnimationFrame(focusCloseButton);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileNavOpen]);

  function openStoryPreview(article) {
    beginStory(article);
    setPreview(true);
  }

  function openPublicStory(article) {
    window.open(`${window.location.origin}/#story=${encodeURIComponent(article.id)}`, '_blank', 'noopener,noreferrer');
  }

  function draftPayload() {
    const { countryText, topicText, bodyText, ...fields } = selected;
    return {
      ...fields,
      countries: countryText.split(',').map((value) => value.trim()).filter(Boolean),
      topics: topicText.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
      content: bodyText.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean).map((text) => text.startsWith('## ') ? { type: 'heading', text: text.slice(3) } : text.startsWith('- ') ? { type: 'list', items: text.split('\n').map((item) => item.replace(/^-\s*/, '')) } : { type: 'paragraph', text }),
    };
  }

  function insertArticleLink() {
    const editor = articleBodyEditor.current;
    const body = selected.bodyText || '';
    const start = editor?.selectionStart ?? body.length;
    const end = editor?.selectionEnd ?? body.length;
    articleLinkSelection.current = { start, end };
    setArticleLinkDraft({ text: body.slice(start, end).trim(), url: '' });
    setArticleLinkComposerOpen(true);
  }

  function saveArticleLink() {
    let url;
    try { url = new URL(articleLinkDraft.url.trim()); } catch {}
    if (!url || !['http:', 'https:'].includes(url.protocol)) {
      setMessage('Enter a full http:// or https:// link destination.');
      return;
    }
    const linkText = articleLinkDraft.text.trim();
    if (!linkText) return;
    const markdown = `[${linkText.replace(/[\[\]]/g, '')}](${url.href})`;
    const { start, end } = articleLinkSelection.current;
    const body = selected.bodyText || '';
    const bodyText = `${body.slice(0, start)}${markdown}${body.slice(end)}`;
    const editor = articleBodyEditor.current;
    setSelected({ ...selected, bodyText });
    setArticleLinkComposerOpen(false);
    requestAnimationFrame(() => {
      editor?.focus();
      editor?.setSelectionRange(start + markdown.length, start + markdown.length);
    });
  }

  async function saveStory(event) {
    event.preventDefault();
    try {
      const result = await request(selected.id ? `/api/editorial/articles/${encodeURIComponent(selected.id)}` : '/api/editorial/articles', { method: selected.id ? 'PATCH' : 'POST', body: JSON.stringify(draftPayload()) });
      setSelected({ ...result, countryText: result.countries.join(', '), topicText: result.topics.join(', '), bodyText: result.content.map((block) => block.text || block.items?.map((item) => `- ${item}`).join('\n') || '').join('\n\n') });
      setMessage(result.status === 'published' ? 'Published story updated.' : result.status === 'archived' ? 'Suspended story updated.' : 'Draft saved.');
      await refreshWorkspace();
    } catch (error) { setMessage(error.message); }
  }

  async function submitForReview() {
    try {
      const result = await request(`/api/editorial/articles/${encodeURIComponent(selected.id)}/submit`, { method: 'POST', body: '{}' });
      beginStory(result);
      setMessage('Submitted to the admin review queue.');
      await refreshWorkspace();
    } catch (error) { setMessage(error.message); }
  }

  async function reviewStory(action) {
    try {
      await request(`/api/editorial/articles/${encodeURIComponent(selected.id)}/review`, { method: 'POST', body: JSON.stringify({ action, note: selected.reviewerNote || '' }) });
      setMessage(action === 'publish' ? 'Story published.' : 'Story returned to the author.');
      setSelected(null);
      await refreshWorkspace();
    } catch (error) { setMessage(error.message); }
  }

  async function setStorySuspended(suspended) {
    if (!selected?.id) return;
    const action = suspended ? 'suspend' : 'restore';
    try {
      await request(`/api/editorial/articles/${encodeURIComponent(selected.id)}/${action}`, { method: 'POST', body: '{}' });
      setMessage(suspended ? 'Story suspended from the public site.' : 'Story restored to the public site.');
      setSelected(null);
      await refreshWorkspace();
    } catch (error) { setMessage(error.message); }
  }

  async function deleteStory() {
    if (!selected?.id || !window.confirm(`Permanently delete “${selected.title}”? This cannot be undone.`)) return;
    try {
      await request(`/api/editorial/articles/${encodeURIComponent(selected.id)}`, { method: 'DELETE' });
      setMessage('Story deleted.');
      setSelected(null);
      await refreshWorkspace();
    } catch (error) { setMessage(error.message); }
  }

  async function addUser(event) {
    event.preventDefault();
    setTeamBusy(true);
    setInvitationLink('');
    try {
      const created = await request('/api/admin/users', { method: 'POST', body: JSON.stringify(newUser) });
      setNewUser({ email: '', role: 'author' });
      if (created.invitationSent) setMessage('Account created. A one-time password setup email has been sent.');
      else {
        setInvitationLink(created.setupUrl || '');
        setMessage('Account created. Share the one-time setup link securely; it expires in 24 hours.');
      }
      await refreshWorkspace();
    } catch (error) { setMessage(error.message); }
    finally { setTeamBusy(false); }
  }

  async function updateUser(userId, changes) {
    setTeamBusy(true);
    try {
      const field = Object.hasOwn(changes, 'role') ? 'role' : 'active';
      await request(`/api/admin/users/${encodeURIComponent(userId)}/${field}`, { method: 'PATCH', body: JSON.stringify(changes) });
      setMessage('Account updated.');
      await refreshWorkspace();
    } catch (error) { setMessage(error.message); }
    finally { setTeamBusy(false); }
  }

  function editMember(member) {
    setEditingMemberId(member.id);
    setMemberProfile({ displayName: member.displayName || '', title: member.title || '', bio: member.bio || '', avatarUrl: member.avatarUrl || '', xUrl: member.xUrl || '', linkedInUrl: member.linkedInUrl || '', instagramUrl: member.instagramUrl || '', facebookUrl: member.facebookUrl || '', websiteUrl: member.websiteUrl || '' });
  }

  async function saveMemberProfile(event, memberId) {
    event.preventDefault();
    setTeamBusy(true);
    try {
      await request(`/api/admin/users/${encodeURIComponent(memberId)}/profile`, { method: 'PATCH', body: JSON.stringify(memberProfile) });
      setEditingMemberId('');
      setMessage('Teammate profile updated.');
      await refreshWorkspace();
    } catch (error) { setMessage(error.message); }
    finally { setTeamBusy(false); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setTeamBusy(true);
    try {
      const updated = await request('/api/editorial/profile', { method: 'PATCH', body: JSON.stringify(profileDraft) });
      setUser(updated);
      setProfileDraft({ displayName: updated.displayName || '', title: updated.title || '', bio: updated.bio || '', avatarUrl: updated.avatarUrl || '', xUrl: updated.xUrl || '', linkedInUrl: updated.linkedInUrl || '', instagramUrl: updated.instagramUrl || '', facebookUrl: updated.facebookUrl || '', websiteUrl: updated.websiteUrl || '' });
      setMessage('Your profile has been saved.');
    } catch (error) { setMessage(error.message); }
    finally { setTeamBusy(false); }
  }

  async function saveSiteSettings(event) {
    event.preventDefault();
    setTeamBusy(true);
    try {
      const updated = await request('/api/admin/site-settings', { method: 'PATCH', body: JSON.stringify(siteSettings) });
      setSiteSettings(updated);
      window.dispatchEvent(new CustomEvent('site-settings-updated', { detail: updated }));
      setMessage('Publication and footer settings saved.');
    } catch (error) { setMessage(error.message); }
    finally { setTeamBusy(false); }
  }

  function updateNewsletterAd(index, key, value) {
    const newsletterAds = [...(siteSettings.newsletterAds || [])];
    newsletterAds[index] = { ...newsletterAds[index], [key]: value };
    setSiteSettings({ ...siteSettings, newsletterAds });
  }

  function addNewsletterAd() {
    const newsletterAds = siteSettings.newsletterAds || [];
    if (newsletterAds.length >= 3) return;
    setSiteSettings({ ...siteSettings, newsletterAds: [...newsletterAds, { title: '', sponsor: '', description: '', imageUrl: '', imageAlt: '', clickUrl: '', active: false }] });
  }

  function removeNewsletterAd(index) {
    setSiteSettings({ ...siteSettings, newsletterAds: (siteSettings.newsletterAds || []).filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateFooterCoverageLink(index, key, value) {
    const footerCoverageLinks = [...(siteSettings.footerCoverageLinks || [])];
    footerCoverageLinks[index] = { ...footerCoverageLinks[index], [key]: value };
    setSiteSettings({ ...siteSettings, footerCoverageLinks });
  }

  function addFooterCoverageLink() {
    const footerCoverageLinks = siteSettings.footerCoverageLinks || [];
    if (footerCoverageLinks.length >= 8) return;
    setSiteSettings({ ...siteSettings, footerCoverageLinks: [...footerCoverageLinks, { label: '', topic: '' }] });
  }

  function removeFooterCoverageLink(index) {
    setSiteSettings({ ...siteSettings, footerCoverageLinks: (siteSettings.footerCoverageLinks || []).filter((_, itemIndex) => itemIndex !== index) });
  }

  async function finishPasswordSetup(event) {
    event.preventDefault();
    if (setupPassword !== setupPasswordConfirm) {
      setMessage('The passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await request('/api/auth/setup-password', { method: 'POST', body: JSON.stringify({ token: setupToken, password: setupPassword }) });
      setSetupToken('');
      setSetupPassword('');
      setSetupPasswordConfirm('');
      window.history.replaceState({}, '', `${window.location.pathname}#studio`);
      setMessage('Password set. Sign in to continue.');
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  }

  const isAdmin = user?.role === 'admin';
  const pendingStories = stories.filter((story) => story.status === 'in_review');
  const draftStories = stories.filter((story) => ['draft', 'needs_edits'].includes(story.status));
  const publishedStories = stories.filter((story) => story.status === 'published');
  const suspendedStories = stories.filter((story) => story.status === 'archived');
  const queueStories = !isAdmin || storyScope === 'all'
    ? stories
    : storyScope === 'review' ? pendingStories
      : storyScope === 'published' ? publishedStories : suspendedStories;
  const workspaceTabs = isAdmin
    ? [['overview', 'Desk'], ['analytics', 'Analytics'], ['stories', 'Stories'], ['campaigns', 'Newsletter'], ['crm', 'CRM'], ['welcome', 'Welcome email'], ['team', 'Team'], ['media', 'Site settings'], ['profile', 'My profile']]
    : [['overview', 'Overview'], ['stories', 'My stories'], ['profile', 'My profile']];
  const workspaceHeading = {
    overview: isAdmin ? ['Editorial overview', 'A live view of the newsroom and publishing queue.'] : ['Your workspace', 'Your drafts, reviews, and published stories in one place.'],
    review: ['Stories', `${pendingStories.length} stories awaiting editorial review.`],
    stories: [isAdmin ? 'Stories' : 'My stories', isAdmin ? 'Review, edit, and publish stories from one list.' : 'Continue a draft or check the status of your submissions.'],
    published: ['Stories', 'Open a published story on the public site.'],
    campaigns: ['Newsletter campaigns', 'Prepare and send email campaigns to your confirmed audience.'],
    analytics: ['Site analytics', 'Understand what readers open, finish, and click.'],
    crm: ['Newsletter CRM', 'Search and review subscriber preferences and consent.'],
    welcome: ['Welcome email', 'Manage the email sent after a reader confirms.'],
    team: ['Editorial team', 'Manage accounts and access to the editorial workspace.'],
    media: ['Site settings', 'Manage the hero image, social profiles, and footer destinations.'],
    profile: ['Your profile', 'Manage the profile details shown to your editorial team.'],
  }[studioView] || ['Editorial workspace', 'Manage your stories and editorial work.'];

  if (loading) return <section className="studio-page"><p>Loading editorial workspace...</p></section>;
  if (!user) return <section className="studio-page editorial-login-page"><div className="studio-heading"><div><span>AZTECH AFRICA</span><h1>Editorial Studio</h1></div></div>{setupToken ? <form className="studio-login" onSubmit={finishPasswordSetup}><h2>Set up your account</h2><label>New password<input type="password" autoComplete="new-password" minLength="12" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} required /></label><label>Confirm password<input type="password" autoComplete="new-password" minLength="12" value={setupPasswordConfirm} onChange={(event) => setSetupPasswordConfirm(event.target.value)} required /></label><button className="button button-orange" disabled={loading} type="submit">Set password</button><p aria-live="polite">{message || 'Choose at least 12 characters. This invitation expires after 24 hours.'}</p></form> : <form className="studio-login" onSubmit={signIn}><h2>Staff sign in</h2><label>Email<input type="email" autoComplete="username" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} required /></label><label>Password<input type="password" autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} required /></label><button className="button button-orange" disabled={loading} type="submit">Sign in</button><p aria-live="polite">{message || 'Access is limited to authorized editors. The first admin must be provisioned with ADMIN_EMAIL and ADMIN_PASSWORD in the Railway service variables.'}</p></form>}</section>;

  const dashboardStats = isAdmin
    ? [[publishedStories.length, 'Published', 'blue'], [pendingStories.length, 'In review', 'orange'], [draftStories.length, 'Drafts', 'navy'], [users.filter((member) => member.active).length, 'Active team', 'green']]
    : [[draftStories.filter((story) => story.status === 'draft').length, 'Drafts', 'navy'], [pendingStories.length, 'In review', 'orange'], [publishedStories.length, 'Published', 'blue'], [stories.filter((story) => story.status === 'needs_edits').length, 'Needs edits', 'green']];
  const recentStories = stories.slice(0, 5);
  const selectedCanEdit = selected && (isAdmin || ['draft', 'needs_edits'].includes(selected.status || 'draft'));

  return (
    <div className="editorial-app-shell">
      <aside className="editorial-app-sidebar">
        <a className="editorial-app-brand" href="#studio" onClick={(event) => { event.preventDefault(); navigateWorkspace('overview'); }}><strong>AZTECH</strong><span>AFRICA</span><small>EDITORIAL STUDIO</small></a>
        <span className="editorial-app-role">{user.role.toUpperCase()} WORKSPACE</span>
        <nav className={`studio-nav${mobileNavOpen ? ' mobile-open' : ''}`} aria-label={`${user.role} workspace pages`}>
          <button ref={workspaceDrawerCloseRef} className="editorial-app-drawer-close" aria-label="Close workspace navigation" onClick={() => setMobileNavOpen(false)} type="button">Close navigation</button>
          {workspaceTabs.map(([view, label]) => <button key={view} aria-current={studioView === view ? 'page' : undefined} className={studioView === view ? 'active' : ''} onClick={() => navigateWorkspace(view)} type="button">{label}{view === 'stories' && pendingStories.length > 0 && <span className="studio-nav-count">{pendingStories.length}</span>}</button>)}
        </nav>
        <div className="editorial-app-sidebar-footer"><span>{user.email}</span><button className="editorial-app-signout" onClick={signOut} type="button">Sign out</button></div>
      </aside>
      {mobileNavOpen && <button className="editorial-app-nav-backdrop" aria-label="Close workspace navigation" onClick={() => { setMobileNavOpen(false); workspaceMenuToggleRef.current?.focus(); }} type="button" />}
      <main className="editorial-app-main">
        <header className="editorial-app-topbar"><button ref={workspaceMenuToggleRef} className="editorial-app-menu-toggle" type="button" aria-label={mobileNavOpen ? 'Close workspace navigation' : 'Open workspace navigation'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(!mobileNavOpen)}><span /><span /><span /></button><div><span>AZTECH AFRICA</span><strong>{workspaceHeading[0]}</strong></div><a className="studio-secondary" href="/">View publication</a></header>
        <section className="studio-page workspace-page">
      <div className="studio-view-heading"><div><span>{isAdmin ? 'AZTECH AFRICA · ADMIN' : 'AZTECH AFRICA · AUTHOR'}</span><h2>{workspaceHeading[0]}</h2><p>{workspaceHeading[1]}</p></div>{(studioView === 'overview' || studioView === 'stories') && <button className="button button-orange" onClick={() => { setStoryScope('all'); beginStory(); }} type="button">New story</button>}</div>

      {studioView === 'campaigns' && isAdmin && <NewsletterCampaigns ownerEmail={user.email} />}
      {studioView === 'crm' && isAdmin && <NewsletterCRM />}
      {studioView === 'welcome' && isAdmin && <WelcomeEmailSettings />}
      {studioView === 'profile' && <form className="studio-profile-form" onSubmit={saveProfile}>
        <label>Display name<input value={profileDraft.displayName} onChange={(event) => setProfileDraft({ ...profileDraft, displayName: event.target.value })} maxLength="100" /></label>
        <label>Editorial title<input value={profileDraft.title} onChange={(event) => setProfileDraft({ ...profileDraft, title: event.target.value })} maxLength="120" /></label>
        <ImageUploadField label="Profile image URL" value={profileDraft.avatarUrl} alt={profileDraft.displayName || 'Profile preview'} onChange={(avatarUrl) => setProfileDraft({ ...profileDraft, avatarUrl })} disabled={teamBusy} />
        <label>Bio<textarea rows="5" value={profileDraft.bio} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} maxLength="600" /></label>
        <fieldset className="author-social-fields"><legend>Public links</legend>{[['xUrl', 'X / Twitter URL'], ['linkedInUrl', 'LinkedIn URL'], ['instagramUrl', 'Instagram URL'], ['facebookUrl', 'Facebook URL'], ['websiteUrl', 'Website URL']].map(([key, label]) => <label key={key}>{label}<input type="url" value={profileDraft[key]} onChange={(event) => setProfileDraft({ ...profileDraft, [key]: event.target.value })} placeholder="https://..." /></label>)}</fieldset>
        <button className="button button-orange" disabled={teamBusy} type="submit">Save profile</button>
      </form>}
      {studioView === 'media' && isAdmin && <section className="studio-image-management"><form className="studio-profile-form" onSubmit={saveSiteSettings}>
        <div className="studio-panel-heading"><div><span>PUBLICATION SETTINGS</span><h3>Public media and links</h3></div></div>
        <ImageUploadField label="Hero image URL" value={siteSettings.heroImageUrl} alt={siteSettings.heroImageAlt || 'Hero image preview'} onChange={(heroImageUrl) => setSiteSettings({ ...siteSettings, heroImageUrl })} disabled={teamBusy} />
        <label>Hero image alt text<input value={siteSettings.heroImageAlt} onChange={(event) => setSiteSettings({ ...siteSettings, heroImageAlt: event.target.value })} maxLength="300" required /></label>
        <fieldset className="footer-settings-fields"><legend>Social links</legend>
          <label>X / Twitter URL<input type="text" value={siteSettings.socialXUrl} onChange={(event) => setSiteSettings({ ...siteSettings, socialXUrl: event.target.value })} placeholder="https://x.com/your-account" /></label>
          <label>LinkedIn URL<input type="text" value={siteSettings.socialLinkedInUrl} onChange={(event) => setSiteSettings({ ...siteSettings, socialLinkedInUrl: event.target.value })} placeholder="https://linkedin.com/company/..." /></label>
          <label>RSS feed URL<input type="text" value={siteSettings.rssFeedUrl} onChange={(event) => setSiteSettings({ ...siteSettings, rssFeedUrl: event.target.value })} /></label>
        </fieldset>
        <fieldset className="footer-settings-fields"><legend>Footer copy and headings</legend>
          <label>About text<textarea rows="3" maxLength="600" value={siteSettings.footerAboutText} onChange={(event) => setSiteSettings({ ...siteSettings, footerAboutText: event.target.value })} /></label>
          <label>Locations<input maxLength="200" value={siteSettings.footerLocationText} onChange={(event) => setSiteSettings({ ...siteSettings, footerLocationText: event.target.value })} /></label>
          <label>Coverage heading<input maxLength="80" value={siteSettings.footerCoverageHeading} onChange={(event) => setSiteSettings({ ...siteSettings, footerCoverageHeading: event.target.value })} /></label>
          <label>Ecosystem heading<input maxLength="80" value={siteSettings.footerEcosystemHeading} onChange={(event) => setSiteSettings({ ...siteSettings, footerEcosystemHeading: event.target.value })} /></label>
          <label>Community heading<input maxLength="80" value={siteSettings.footerCommunityHeading} onChange={(event) => setSiteSettings({ ...siteSettings, footerCommunityHeading: event.target.value })} /></label>
          <label>Community text<textarea rows="2" maxLength="300" value={siteSettings.footerCommunityText} onChange={(event) => setSiteSettings({ ...siteSettings, footerCommunityText: event.target.value })} /></label>
          <label>RSS link label<input maxLength="60" value={siteSettings.footerRssLabel} onChange={(event) => setSiteSettings({ ...siteSettings, footerRssLabel: event.target.value })} /></label>
          <label>Advertise link label<input maxLength="80" value={siteSettings.footerAdvertiseLabel} onChange={(event) => setSiteSettings({ ...siteSettings, footerAdvertiseLabel: event.target.value })} /></label>
          <label>Copyright text<textarea rows="2" maxLength="300" value={siteSettings.footerCopyrightText} onChange={(event) => setSiteSettings({ ...siteSettings, footerCopyrightText: event.target.value })} /></label>
        </fieldset>
        <fieldset className="footer-settings-fields footer-coverage-links"><legend>Coverage links</legend>
          {(siteSettings.footerCoverageLinks || []).map((link, index) => <div className="footer-coverage-link" key={`footer-coverage-${index}`}>
            <label>Link label<input maxLength="100" value={link.label} onChange={(event) => updateFooterCoverageLink(index, 'label', event.target.value)} required /></label>
            <label>Topic key<input maxLength="80" value={link.topic} onChange={(event) => updateFooterCoverageLink(index, 'topic', event.target.value.toLowerCase())} placeholder="e.g. fintech" /></label>
            <button className="studio-secondary" onClick={() => removeFooterCoverageLink(index)} type="button">Remove link</button>
          </div>)}
          <button className="studio-secondary" disabled={(siteSettings.footerCoverageLinks || []).length >= 8} onClick={addFooterCoverageLink} type="button">Add coverage link</button>
        </fieldset>
        <fieldset className="footer-settings-fields"><legend>Footer destinations</legend>
          <label>Sahara Ventures label<input maxLength="100" value={siteSettings.saharaVenturesLabel} onChange={(event) => setSiteSettings({ ...siteSettings, saharaVenturesLabel: event.target.value })} /></label>
          <label>Sahara Ventures URL<input type="text" value={siteSettings.saharaVenturesUrl} onChange={(event) => setSiteSettings({ ...siteSettings, saharaVenturesUrl: event.target.value })} /></label>
          <label>S-BAN label<input maxLength="100" value={siteSettings.sbanLabel} onChange={(event) => setSiteSettings({ ...siteSettings, sbanLabel: event.target.value })} /></label>
          <label>S-BAN URL<input type="text" value={siteSettings.sbanUrl} onChange={(event) => setSiteSettings({ ...siteSettings, sbanUrl: event.target.value })} /></label>
          <label>ICT Commission label<input maxLength="100" value={siteSettings.ictCommissionLabel} onChange={(event) => setSiteSettings({ ...siteSettings, ictCommissionLabel: event.target.value })} /></label>
          <label>ICT Commission URL<input type="text" value={siteSettings.ictCommissionUrl} onChange={(event) => setSiteSettings({ ...siteSettings, ictCommissionUrl: event.target.value })} /></label>
          <label>Deal sheet label<input maxLength="100" value={siteSettings.dealSheetLabel} onChange={(event) => setSiteSettings({ ...siteSettings, dealSheetLabel: event.target.value })} /></label>
          <label>Deal sheet URL<input type="text" value={siteSettings.dealSheetUrl} onChange={(event) => setSiteSettings({ ...siteSettings, dealSheetUrl: event.target.value })} /></label>
          <label>Contact link label<input maxLength="80" value={siteSettings.contactDeskLabel} onChange={(event) => setSiteSettings({ ...siteSettings, contactDeskLabel: event.target.value })} /></label>
          <label>Contact email<input type="email" value={siteSettings.contactEmail} onChange={(event) => setSiteSettings({ ...siteSettings, contactEmail: event.target.value })} placeholder="editor@aztechafrica.site" /></label>
          <label>Privacy link label<input maxLength="80" value={siteSettings.privacyPolicyLabel} onChange={(event) => setSiteSettings({ ...siteSettings, privacyPolicyLabel: event.target.value })} /></label>
          <label>Privacy policy URL<input type="text" value={siteSettings.privacyPolicyUrl} onChange={(event) => setSiteSettings({ ...siteSettings, privacyPolicyUrl: event.target.value })} /></label>
          <label>Editorial ethics link label<input maxLength="80" value={siteSettings.editorialEthicsLabel} onChange={(event) => setSiteSettings({ ...siteSettings, editorialEthicsLabel: event.target.value })} /></label>
          <label>Editorial ethics URL<input type="text" value={siteSettings.editorialEthicsUrl} onChange={(event) => setSiteSettings({ ...siteSettings, editorialEthicsUrl: event.target.value })} /></label>
        </fieldset>
        <section className="newsletter-ad-settings"><div className="newsletter-ad-settings-heading"><div><strong>Sponsored newsletter cards</strong><p>Active cards appear as clearly labelled sponsored placements in the email.</p></div><button className="studio-secondary" disabled={(siteSettings.newsletterAds || []).length >= 3} onClick={addNewsletterAd} type="button">Add sponsored card</button></div>
          {(siteSettings.newsletterAds || []).map((ad, index) => <fieldset className="newsletter-ad-card" key={`newsletter-ad-${index}`}><legend>Sponsored card {index + 1}</legend>
            <label className="newsletter-ad-active"><input checked={ad.active} onChange={(event) => updateNewsletterAd(index, 'active', event.target.checked)} type="checkbox" /> Active in newsletter</label>
            <div className="footer-settings-fields"><label>Sponsor name<input value={ad.sponsor} onChange={(event) => updateNewsletterAd(index, 'sponsor', event.target.value)} /></label><label>Card headline<input value={ad.title} onChange={(event) => updateNewsletterAd(index, 'title', event.target.value)} /></label><label>Description<input value={ad.description} onChange={(event) => updateNewsletterAd(index, 'description', event.target.value)} /></label><ImageUploadField label="Image URL" value={ad.imageUrl} alt={ad.imageAlt || 'Sponsored card preview'} onChange={(imageUrl) => updateNewsletterAd(index, 'imageUrl', imageUrl)} /><label>Image alt text<input value={ad.imageAlt} onChange={(event) => updateNewsletterAd(index, 'imageAlt', event.target.value)} /></label><label>Click-through URL<input type="text" value={ad.clickUrl} onChange={(event) => updateNewsletterAd(index, 'clickUrl', event.target.value)} placeholder="https://..." /></label></div>
            <button className="studio-secondary" onClick={() => removeNewsletterAd(index)} type="button">Remove card</button>
          </fieldset>)}
        </section>
        <p>Use an https URL, an on-site path, or a page anchor. Story images are edited in each story.</p>
        <button className="button button-orange" disabled={teamBusy} type="submit">Save site settings</button>
      </form></section>}
      {studioView === 'overview' && <div className="studio-overview">
        <div className="studio-stats-grid">{dashboardStats.map(([value, label, color]) => <article className="studio-stat" key={label}><strong className={`studio-stat-${color}`}>{value}</strong><span>{label}</span></article>)}</div>
        <div className="studio-overview-grid">
          <section className="studio-panel"><div className="studio-panel-heading"><div><span>WORK IN PROGRESS</span><h3>Recent stories</h3></div><button className="studio-text-action" onClick={() => { setStoryScope('all'); setStudioView('stories'); }} type="button">View all</button></div>
            {recentStories.length ? <div className="studio-recent-list">{recentStories.map((story) => <button className="studio-recent-story" key={story.id} onClick={() => beginStory(story)} type="button"><span className={`status status-${story.status}`}>{story.status.replace('_', ' ')}</span><strong>{story.title}</strong><small>{story.authorEmail} · {story.category} · {story.readTime}</small></button>)}</div> : <div className="studio-empty"><h3>No stories yet</h3><p>Start a draft to begin your editorial work.</p><button className="button button-orange" onClick={() => { setStoryScope('all'); beginStory(); }} type="button">Create first story</button></div>}
          </section>
          <section className="studio-panel studio-next-panel"><span>{isAdmin ? 'EDITORIAL DESK' : 'YOUR NEXT STEP'}</span><h3>{isAdmin ? `${pendingStories.length} stories need review` : `${draftStories.length} drafts in progress`}</h3><p>{isAdmin ? 'Review submissions, publish ready stories, or return drafts with a clear note.' : 'Drafts stay private until you submit them for editorial review.'}</p><button className="button button-blue" onClick={() => { setStoryScope(isAdmin ? 'review' : 'all'); setStudioView('stories'); }} type="button">{isAdmin ? 'Review stories' : 'Open my stories'}</button></section>
        </div>
      </div>}
      {studioView === 'analytics' && isAdmin && <AnalyticsDashboard stories={stories} />}

      {studioView === 'stories' && <div className="studio-layout">
        {isAdmin && <div className="studio-story-filters" aria-label="Filter stories"><button aria-pressed={storyScope === 'all'} onClick={() => setStoryScope('all')} type="button">All ({stories.length})</button><button aria-pressed={storyScope === 'review'} onClick={() => setStoryScope('review')} type="button">In review ({pendingStories.length})</button><button aria-pressed={storyScope === 'published'} onClick={() => setStoryScope('published')} type="button">Published ({publishedStories.length})</button><button aria-pressed={storyScope === 'suspended'} onClick={() => setStoryScope('suspended')} type="button">Suspended ({suspendedStories.length})</button></div>}
        <div className="studio-queue">
          <div className="studio-queue-heading"><h2>{storyScope === 'review' ? 'Awaiting review' : storyScope === 'published' ? 'Published stories' : storyScope === 'suspended' ? 'Suspended stories' : isAdmin ? 'All stories' : 'My stories'}</h2><span>{queueStories.length} total</span></div>
          {queueStories.map((story) => <button className={`studio-story${story.imageUrl ? ' has-image' : ''}${selected?.id === story.id ? ' selected' : ''}`} key={story.id} onClick={() => beginStory(story)} type="button">{story.imageUrl && <img className="studio-story-thumbnail" src={story.imageUrl} alt={story.imageAlt || ''} loading="lazy" />}<span className={`status status-${story.status}`}>{story.status === 'archived' ? 'Suspended' : story.status.replace('_', ' ')}</span><strong>{story.title}</strong><small>{story.authorEmail} · {story.category}</small>{isAdmin && <small>Owner: {story.ownerEmail || 'makayaemmanuel42@gmail.com'}</small>}</button>)}
          {!queueStories.length && <div className="studio-empty"><h3>Nothing here yet</h3><p>{storyScope === 'review' ? 'New submissions will appear here.' : storyScope === 'published' ? 'Published stories will appear here.' : storyScope === 'suspended' ? 'Suspended stories will appear here.' : 'Create a story draft to get started.'}</p>{storyScope === 'all' && <button className="button button-orange" onClick={() => { setStoryScope('all'); beginStory(); }} type="button">New story</button>}</div>}
        </div>
        <div className="studio-editor">
          {selected ? <>
            <div className="studio-editor-heading"><div><span className={`status status-${selected.status || 'draft'}`}>{selected.status === 'archived' ? 'Suspended' : (selected.status || 'draft').replace('_', ' ')}</span><h2>{selected.id ? 'Edit story' : 'New story draft'}</h2></div><button className="studio-secondary" type="button" onClick={() => setPreview(!preview)}>{preview ? 'Edit fields' : 'Preview'}</button></div>
            {user.role === 'author' && selected.status === 'in_review' && <p className="studio-review-lock">Submitted for review. Editing is available after an admin returns this story.</p>}
            {message && <p className="studio-message" aria-live="polite">{message}</p>}
            {preview ? <article className="story-preview"><span>{selected.label}</span><h2>{selected.title || 'Untitled story'}</h2><p>{selected.description}</p><div>{selected.bodyText}</div></article> : <form className="story-form" onSubmit={saveStory}>
              <fieldset className="story-fields" disabled={!selectedCanEdit}>
              <section className="story-editor-section"><h3>Story basics</h3><label>Title<input value={selected.title} onChange={(event) => setSelected({ ...selected, title: event.target.value, cardTitle: selected.cardTitle || event.target.value })} required /></label>
              <label>Card headline<input value={selected.cardTitle || ''} onChange={(event) => setSelected({ ...selected, cardTitle: event.target.value })} /></label>
              <div className="studio-fields">
                <label>Story type<select value={selected.category} onChange={(event) => { const category = event.target.value; setSelected({ ...selected, category, label: category === 'opportunity' ? 'VERIFIED OPPORTUNITY' : category === 'event' ? 'EAST AFRICA EVENT' : category, tag: category === 'opportunity' ? 'Opportunity Listing' : category === 'event' ? 'Community Event' : category, metadata: {} }); }}><option value="roundup">Weekly roundup</option><option value="fintech">Fintech</option><option value="community">Founder voices</option><option value="investing">VC &amp; investing</option><option value="analysis">Analysis</option><option value="opportunity">Opportunity</option><option value="event">Event</option></select></label>
                <label>Read time<input value={selected.readTime || ''} onChange={(event) => setSelected({ ...selected, readTime: event.target.value })} /></label>
              </div>
              <label>Summary<textarea rows="3" value={selected.description} onChange={(event) => setSelected({ ...selected, description: event.target.value })} required /></label>
              </section>
              <section className="story-editor-section"><h3>Cover and coverage</h3>
              <div className="studio-fields"><ImageUploadField label="Story image URL" value={selected.imageUrl || ''} alt={selected.imageAlt || ''} onChange={(imageUrl) => setSelected({ ...selected, imageUrl })} /><label>Image alt text<input value={selected.imageAlt || ''} onChange={(event) => setSelected({ ...selected, imageAlt: event.target.value })} maxLength="300" /></label></div>
              <div className="studio-fields"><label>Countries (comma separated)<input value={selected.countryText} onChange={(event) => setSelected({ ...selected, countryText: event.target.value })} /></label><label>Topics (comma separated)<input value={selected.topicText} onChange={(event) => setSelected({ ...selected, topicText: event.target.value })} /></label></div>
              </section>
              <StructuredMetadataFields category={selected.category} metadata={selected.metadata} onChange={(key, value) => setSelected({ ...selected, metadata: { ...(selected.metadata || {}), [key]: value } })} />
              <section className="story-editor-section"><h3>Article content</h3>
              <div className="article-content-tools"><button className="studio-secondary" onClick={insertArticleLink} type="button">Insert link</button></div>
              {articleLinkComposerOpen && <div className="article-link-composer" role="group" aria-label="Insert article link"><label>Link text<input value={articleLinkDraft.text} onChange={(event) => setArticleLinkDraft({ ...articleLinkDraft, text: event.target.value })} required /></label><label>Destination URL<input type="url" value={articleLinkDraft.url} onChange={(event) => setArticleLinkDraft({ ...articleLinkDraft, url: event.target.value })} placeholder="https://..." required /></label><button className="button button-orange" onClick={saveArticleLink} type="button">Add link</button><button className="studio-secondary" onClick={() => setArticleLinkComposerOpen(false)} type="button">Cancel</button></div>}
              <label>Article content<textarea ref={articleBodyEditor} rows="9" value={selected.bodyText} onChange={(event) => setSelected({ ...selected, bodyText: event.target.value })} placeholder="Separate paragraphs with a blank line. Use [source](https://example.com) for links." /></label>
              </section>
              </fieldset>
              <div className="studio-actions">{selectedCanEdit && <button className="button button-orange" type="submit">{['draft', 'needs_edits'].includes(selected.status || 'draft') ? 'Save draft' : 'Save changes'}</button>}{user.role === 'author' && selected.id && ['draft', 'needs_edits'].includes(selected.status) && <button className="studio-secondary" onClick={submitForReview} type="button">Submit for review</button>}{user.role === 'admin' && selected.status === 'in_review' && <><label className="review-note">Return note<input value={selected.reviewerNote || ''} onChange={(event) => setSelected({ ...selected, reviewerNote: event.target.value })} /></label><button className="studio-secondary" onClick={() => reviewStory('return')} type="button">Return for edits</button><button className="button button-orange" onClick={() => reviewStory('publish')} type="button">Publish</button></>}{user.role === 'admin' && selected.id && selected.status === 'published' && <button className="studio-secondary" onClick={() => setStorySuspended(true)} type="button">Suspend story</button>}{user.role === 'admin' && selected.id && selected.status === 'archived' && <button className="studio-secondary" onClick={() => setStorySuspended(false)} type="button">Restore story</button>}{user.role === 'admin' && selected.id && <button className="studio-danger" onClick={deleteStory} type="button">Delete story</button>}</div>
            </form>}
          </> : <div className="studio-empty"><h2>{storyScope === 'review' ? 'Choose a submission to review' : 'Choose a story or start a draft'}</h2><p>{storyScope === 'review' ? 'Review its sources and details, then publish or return it with notes.' : 'Open a story from the list or create a new draft.'}</p></div>}
          {!selected && message && <p aria-live="polite" className="studio-message">{message}</p>}
        </div>
      </div>}

      {studioView === 'team' && isAdmin && <section className="team-management studio-team-page">
        <div className="studio-panel-heading"><div><span>ACCESS CONTROL</span><h3>Invite a teammate</h3></div></div>
        <form onSubmit={addUser}>
          <label>Email<input type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required /></label>
          <label>Role<select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}><option value="author">Author</option><option value="admin">Admin</option></select></label>
          <button className="button button-orange" disabled={teamBusy} type="submit">{teamBusy ? 'Creating...' : 'Create account'}</button>
        </form>
        <p className="team-invite-note">Teammates set their own password from a one-time email invitation. Email delivery must be configured.</p>
        {invitationLink && <p className="team-invite-link">Setup link: <a href={invitationLink} target="_blank" rel="noreferrer">Open one-time password setup</a></p>}
        <div className="studio-team-list">
          <div className="studio-panel-heading"><div><span>PEOPLE</span><h3>Editorial team</h3></div><span>{users.length} accounts</span></div>
          {users.map((member) => <article className="studio-team-member" key={member.id}>
            <div className="team-member-main">{member.avatarUrl && <img src={member.avatarUrl} alt="" />}<div><strong>{member.displayName || member.email}</strong><span>{member.title || member.email}</span><span>{member.role} · {member.active ? 'Active' : 'Disabled'}</span>{member.bio && <p>{member.bio}</p>}</div></div>
            <div className="team-member-actions">
              <button className="studio-secondary" disabled={teamBusy} onClick={() => editingMemberId === member.id ? setEditingMemberId('') : editMember(member)} type="button">{editingMemberId === member.id ? 'Cancel profile edit' : 'Edit profile'}</button>
              <button className="studio-secondary" disabled={teamBusy} onClick={() => updateUser(member.id, { role: member.role === 'admin' ? 'author' : 'admin' })} type="button">Make {member.role === 'admin' ? 'author' : 'admin'}</button>
              <button className="studio-secondary" disabled={teamBusy || (member.id === user.id && member.active)} onClick={() => updateUser(member.id, { active: !member.active })} type="button">{member.active ? 'Disable' : 'Activate'}</button>
              {editingMemberId === member.id && <form className="team-profile-edit" onSubmit={(event) => saveMemberProfile(event, member.id)}>
                <label>Display name<input value={memberProfile.displayName} onChange={(event) => setMemberProfile({ ...memberProfile, displayName: event.target.value })} /></label>
                <label>Title<input value={memberProfile.title} onChange={(event) => setMemberProfile({ ...memberProfile, title: event.target.value })} /></label>
                <ImageUploadField label="Profile image URL" value={memberProfile.avatarUrl} alt={memberProfile.displayName || member.email} onChange={(avatarUrl) => setMemberProfile({ ...memberProfile, avatarUrl })} disabled={teamBusy} />
                <label>Bio<textarea rows="3" value={memberProfile.bio} onChange={(event) => setMemberProfile({ ...memberProfile, bio: event.target.value })} /></label>
                <fieldset className="author-social-fields"><legend>Public links</legend>{[['xUrl', 'X / Twitter URL'], ['linkedInUrl', 'LinkedIn URL'], ['instagramUrl', 'Instagram URL'], ['facebookUrl', 'Facebook URL'], ['websiteUrl', 'Website URL']].map(([key, label]) => <label key={key}>{label}<input type="url" value={memberProfile[key]} onChange={(event) => setMemberProfile({ ...memberProfile, [key]: event.target.value })} placeholder="https://..." /></label>)}</fieldset>
                <button className="button button-orange" disabled={teamBusy} type="submit">Save teammate profile</button>
              </form>}
            </div>
          </article>)}
        </div>
      </section>}
      {message && studioView !== 'stories' && studioView !== 'review' && <p className="studio-message" aria-live="polite">{message}</p>}
        </section>
      </main>
    </div>
  );
}

function Footer({ siteSettings = defaultSiteSettings }) {
  const ecosystemLinks = [
    [siteSettings.saharaVenturesLabel, siteSettings.saharaVenturesUrl],
    [siteSettings.sbanLabel, siteSettings.sbanUrl],
    [siteSettings.ictCommissionLabel, siteSettings.ictCommissionUrl],
    [siteSettings.dealSheetLabel, siteSettings.dealSheetUrl],
  ].filter(([, href]) => href);
  const legalLinks = [
    [siteSettings.privacyPolicyLabel, siteSettings.privacyPolicyUrl],
    [siteSettings.editorialEthicsLabel, siteSettings.editorialEthicsUrl],
    [siteSettings.contactDeskLabel, siteSettings.contactEmail ? `mailto:${siteSettings.contactEmail}` : ''],
  ].filter(([, href]) => href);

  return <footer className="site-footer"><div className="footer-inner"><div className="footer-grid">
    <div className="footer-about"><a className="footer-brand" href="#top"><span>AZ</span><strong>AzTech Africa</strong></a><p>{siteSettings.footerAboutText}</p><span>{siteSettings.footerLocationText}</span></div>
    <div><h2>{siteSettings.footerCoverageHeading}</h2>{(siteSettings.footerCoverageLinks || []).map(({ label, topic }, index) => <a href="#featured-articles" key={`${topic}-${index}`} onClick={() => topic && window.dispatchEvent(new CustomEvent('site-topic-filter', { detail: topic }))}>{label}</a>)}</div>
    <div><h2>{siteSettings.footerEcosystemHeading}</h2>{ecosystemLinks.map(([label, href]) => <a href={href} key={label} target={href.startsWith('https:') ? '_blank' : undefined} rel={href.startsWith('https:') ? 'noreferrer' : undefined}>{label}</a>)}{siteSettings.rssFeedUrl && <a href={siteSettings.rssFeedUrl} target="_blank" rel="noreferrer">{siteSettings.footerRssLabel}</a>}{siteSettings.contactEmail && <a href={`mailto:${siteSettings.contactEmail}`}>{siteSettings.footerAdvertiseLabel}</a>}</div>
    <div className="footer-community"><h2>{siteSettings.footerCommunityHeading}</h2><p>{siteSettings.footerCommunityText}</p><div className="social-links">{siteSettings.socialXUrl && <a href={siteSettings.socialXUrl} aria-label="X / Twitter" target="_blank" rel="noreferrer">𝕏</a>}{siteSettings.socialLinkedInUrl && <a href={siteSettings.socialLinkedInUrl} aria-label="LinkedIn" target="_blank" rel="noreferrer">in</a>}{siteSettings.rssFeedUrl && <a href={siteSettings.rssFeedUrl} aria-label={siteSettings.footerRssLabel} target="_blank" rel="noreferrer">RSS</a>}</div></div>
  </div><div className="footer-bottom"><p>{siteSettings.footerCopyrightText}</p>{legalLinks.length > 0 && <div>{legalLinks.map(([label, href], index) => <span className="footer-legal-link" key={label}>{index > 0 && <span aria-hidden="true"> · </span>}<a href={href}>{label}</a></span>)}</div>}</div></div></footer>;
}

function ArticlePage({ article, author, relatedArticles, onBack, onOpen, onOpenAuthor }) {
  const [readingProgress, setReadingProgress] = useState(0);
  const showsProgress = /deep dive|policy/i.test(`${article?.tag || ''} ${article?.label || ''}`);
  const storyUrl = `${window.location.origin}${window.location.pathname}#story=${encodeURIComponent(article?.id || '')}`;
  const encodedStoryUrl = encodeURIComponent(storyUrl);
  const encodedTitle = encodeURIComponent(article?.title || '');
  const encodedShareText = encodeURIComponent(`${article?.title || ''} ${storyUrl}`);
  const shareLinks = [
    ['X', `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedStoryUrl}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodedStoryUrl}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${encodedStoryUrl}`],
    ['WhatsApp', `https://wa.me/?text=${encodedShareText}`],
    ['Telegram', `https://t.me/share/url?url=${encodedStoryUrl}&text=${encodedTitle}`],
    ['Email', `mailto:?subject=${encodedTitle}&body=${encodedShareText}`],
  ];

  useEffect(() => {
    if (!article) return undefined;
    const previousTitle = document.title;
    document.title = `${article.title} | AzTech Africa`;
    return () => { document.title = previousTitle; };
  }, [article]);

  useEffect(() => {
    if (!article) return undefined;
    let completionTracked = false;
    const updateProgress = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? Math.round((window.scrollY / scrollableHeight) * 100) : 100;
      if (showsProgress) setReadingProgress(progress);
      if (!completionTracked && progress >= 90) {
        completionTracked = true;
        sendAnalyticsEvent({ type: 'story_complete', path: window.location.pathname, contentId: article.id });
      }
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [article, showsProgress]);

  if (!article) return null;
  return (
    <main className="article-reader-page">
      {showsProgress && <div className="reading-progress" role="progressbar" aria-label="Article reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={readingProgress}><span style={{ width: `${readingProgress}%` }} /></div>}
      <header className="reader-heading">
        {article.imageUrl && <img className="reader-heading-image" src={article.imageUrl} alt="" aria-hidden="true" />}
        <div className="reader-heading-inner">
          <button className="reader-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> All stories</button>
          <div className="reader-kicker"><span className={`article-label label-${article.category}`}>{article.label}</span><span>{article.readTime}</span></div>
          <h1>{article.title}</h1>
          <p className="reader-deck">{article.description}</p>
          <div className="reader-byline"><span>{author && <AuthorAvatar author={author} className="reader-author-avatar" />}{author ? <button className="reader-author-link" type="button" onClick={() => onOpenAuthor(author)}>{author.displayName || 'AzTech Africa contributor'}</button> : article.authorDisplayName || 'AzTech Africa Editorial Team'}{author?.title && <small>{author.title}</small>}</span><span>{article.date}</span></div>
        </div>
      </header>
      <div className="reader-layout content-width">
        <article className="reader-content">
          {article.imageUrl && <img className="reader-hero-image" src={article.imageUrl} alt={article.imageAlt || ''} />}
          {article.metadata?.sourceUrl && <div className="reader-source"><div><strong>Primary source</strong>{article.metadata.verifiedAt && <span>Verified {article.metadata.verifiedAt}</span>}</div><a href={article.metadata.sourceUrl} target="_blank" rel="noreferrer">Open original source <Arrow size={14} /></a></div>}
          {article.content?.map((block, index) => block.type === 'heading'
            ? <h2 key={index}>{renderInlineLinks(block.text)}</h2>
            : block.type === 'list'
              ? <ul key={index}>{block.items.map((item) => <li key={item}>{renderInlineLinks(item)}</li>)}</ul>
              : <p key={index}>{renderInlineLinks(block.text)}</p>)}
          <div className="reader-share"><strong>Share this story</strong><nav aria-label="Share this story"><span>Send to</span>{shareLinks.map(([label, href]) => <a href={href} key={label} target={href.startsWith('mailto:') ? undefined : '_blank'} rel={href.startsWith('mailto:') ? undefined : 'noreferrer'}>{label}</a>)}</nav></div>
        </article>
        <aside className="reader-sidebar">
          <section className="reader-facts"><h2>Story details</h2><dl>
            <div><dt>Coverage</dt><dd>{(article.countries || []).join(', ') || 'East Africa'}</dd></div>
            {(article.topics || []).length > 0 && <div><dt>Topics</dt><dd>{article.topics.join(', ')}</dd></div>}
            {article.metadata?.opportunityType && <div><dt>Opportunity</dt><dd>{article.metadata.opportunityType}</dd></div>}
            {article.metadata?.amount && <div><dt>Value</dt><dd>{article.metadata.amount}</dd></div>}
            {article.metadata?.deadline && <div><dt>Deadline</dt><dd>{article.metadata.deadline}</dd></div>}
            {article.metadata?.eligibility && <div><dt>Eligibility</dt><dd>{article.metadata.eligibility}</dd></div>}
            {article.metadata?.startDate && <div><dt>Event date</dt><dd>{article.metadata.startDate}{article.metadata.endDate ? ` to ${article.metadata.endDate}` : ''}</dd></div>}
            {article.metadata?.venue && <div><dt>Venue</dt><dd>{article.metadata.venue}</dd></div>}
            {article.metadata?.audience && <div><dt>Audience</dt><dd>{article.metadata.audience}</dd></div>}
            {article.metadata?.cost && <div><dt>Cost</dt><dd>{article.metadata.cost}</dd></div>}
          </dl></section>
          {article.metadata?.registrationUrl && <a className="reader-action" href={article.metadata.registrationUrl} target="_blank" rel="noreferrer">Register for this event <Arrow size={14} /></a>}
          <section className="reader-related"><h2>More from AzTech</h2>{relatedArticles.map((related) => <button key={related.id} type="button" onClick={() => onOpen(related)}><span>{related.label}</span><strong>{related.cardTitle}</strong><small>{related.readTime}</small></button>)}<button className="reader-all-stories" type="button" onClick={onBack}>Back to all stories</button></section>
        </aside>
      </div>
    </main>
  );
}

function renderInlineLinks(value = '') {
  const text = String(value);
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/gi;
  const nodes = [];
  let lastIndex = 0;
  let match;
  while ((match = linkPattern.exec(text))) {
    const label = match[1];
    const rawUrl = match[2] || match[3];
    const url = rawUrl.replace(/[.,!?;:]+$/, '');
    let isWebUrl = false;
    try {
      const parsed = new URL(url);
      isWebUrl = ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname);
    } catch {}
    if (!isWebUrl) continue;
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(<a href={url} key={`${match.index}-${url}`} rel="noreferrer" target="_blank">{label || url}</a>);
    const punctuation = rawUrl.slice(url.length);
    if (punctuation) nodes.push(punctuation);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function AuthorProfilePage({ author, articles, onBack, onOpen }) {
  const authoredStories = author ? articles.filter((article) => author.storyIds.includes(article.id)) : [];
  const socialLinks = [
    ['X / Twitter', author?.xUrl],
    ['LinkedIn', author?.linkedInUrl],
    ['Instagram', author?.instagramUrl],
    ['Facebook', author?.facebookUrl],
    ['Website', author?.websiteUrl],
  ].filter(([, href]) => href);

  useEffect(() => {
    if (!author) return undefined;
    const previousTitle = document.title;
    document.title = `${author.displayName || 'Author'} | AzTech Africa`;
    return () => { document.title = previousTitle; };
  }, [author]);

  if (!author) return <main className="author-profile-page content-width"><button className="reader-back" type="button" onClick={onBack}>All stories</button><p>This author profile is unavailable.</p></main>;
  return <main className="author-profile-page content-width">
    <button className="author-profile-back" type="button" onClick={onBack}>← All stories</button>
    <section className="author-profile-heading">
      <AuthorAvatar author={author} className="author-profile-avatar" alt={`${author.displayName || 'Author'} portrait`} />
      <div><span>AZTECH AFRICA CONTRIBUTOR</span><h1>{author.displayName || 'AzTech Africa contributor'}</h1>{author.title && <h2>{author.title}</h2>}{author.bio && <p>{author.bio}</p>}
        {socialLinks.length > 0 && <nav className="author-social-links" aria-label={`${author.displayName || 'Author'} social links`}>{socialLinks.map(([label, href]) => <a href={href} key={label} target="_blank" rel="noreferrer">{label}<Arrow size={13} /></a>)}</nav>}
      </div>
    </section>
    <section className="author-stories"><header><span>PUBLICATIONS</span><h2>Stories by {author.displayName || 'this contributor'}</h2></header>
      {authoredStories.length ? <div className="article-grid">{authoredStories.map((article) => <ArticleCard key={article.id} article={article} />)}</div> : <p>No published stories yet.</p>}
    </section>
  </main>;
}

export default function App() {
  const [articles, setArticles] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [siteSettings, setSiteSettings] = useState(defaultSiteSettings);
  const [activeFilter, setActiveFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmedSubscribers, setConfirmedSubscribers] = useState(0);
  const [studioOpen, setStudioOpen] = useState(window.location.hash === '#studio');
  const lastAnalyticsPage = useRef('');

  useEffect(() => {
    const onHashChange = () => setStudioOpen(window.location.hash === '#studio');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (studioOpen) {
      lastAnalyticsPage.current = '';
      return undefined;
    }
    const hash = window.location.hash;
    const storyMatch = hash.match(/^#(?:story|read)=(.+)$/);
    const authorMatch = hash.match(/^#author=(.+)$/);
    let contentId = null;
    let type = 'page_view';
    let pageKey = window.location.pathname;
    if (storyMatch) {
      try { contentId = decodeURIComponent(storyMatch[1]); } catch { contentId = storyMatch[1]; }
      type = 'story_view';
      pageKey += `#story=${contentId}`;
    } else if (authorMatch) {
      try { contentId = decodeURIComponent(authorMatch[1]); } catch { contentId = authorMatch[1]; }
      pageKey += `#author=${contentId}`;
    }
    if (lastAnalyticsPage.current !== pageKey) {
      lastAnalyticsPage.current = pageKey;
      sendAnalyticsEvent({ type, path: window.location.pathname, contentId, label: authorMatch ? 'Author profile' : '' });
    }
  }, [studioOpen, selectedArticle?.id, selectedAuthor?.id]);

  useEffect(() => {
    if (studioOpen) return undefined;
    const trackPublicClick = (event) => {
      const control = event.target instanceof Element ? event.target.closest('a, button, summary') : null;
      if (!control || control.closest('.editorial-app-shell') || control.getAttribute('href') === '#studio') return;
      const label = (control.getAttribute('aria-label') || control.innerText || control.getAttribute('title') || 'Unlabelled control').replace(/\s+/g, ' ').trim().slice(0, 120);
      let destination = '';
      let contentId = selectedArticle?.id || null;
      if (control instanceof HTMLAnchorElement && control.href) {
        try {
          const url = new URL(control.href);
          destination = `${url.origin === window.location.origin ? '' : url.origin}${url.pathname}`;
          const storyMatch = url.hash.match(/^#(?:story|read)=(.+)$/);
          if (storyMatch) {
            try { contentId = decodeURIComponent(storyMatch[1]); } catch { contentId = storyMatch[1]; }
          }
        } catch {}
      }
      sendAnalyticsEvent({ type: 'click', path: window.location.pathname, contentId, label, destination });
    };
    document.addEventListener('click', trackPublicClick);
    return () => document.removeEventListener('click', trackPublicClick);
  }, [studioOpen, selectedArticle?.id]);

  useEffect(() => {
    fetch('/api/authors').then((response) => response.ok ? response.json() : [])
      .then((authorList) => setAuthors(Array.isArray(authorList) ? authorList : []))
      .catch(() => setAuthors([]));
  }, []);

  useEffect(() => {
    const onSettingsUpdated = (event) => setSiteSettings((current) => ({ ...current, ...event.detail }));
    const onFooterTopic = (event) => {
      setActiveFilter(event.detail);
      setCountryFilter('all');
      setSearch('');
      window.dispatchEvent(new CustomEvent('site-search', { detail: '' }));
    };
    window.addEventListener('site-settings-updated', onSettingsUpdated);
    window.addEventListener('site-topic-filter', onFooterTopic);
    return () => {
      window.removeEventListener('site-settings-updated', onSettingsUpdated);
      window.removeEventListener('site-topic-filter', onFooterTopic);
    };
  }, []);

  useEffect(() => {
    fetch('/api/articles').then((response) => {
      if (!response.ok) throw new Error('Unable to load articles');
      return response.json();
    }).then(setArticles).catch(() => setArticles([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/site-settings').then((response) => response.ok ? response.json() : null)
      .then((settings) => { if (settings) setSiteSettings(settings); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/stats').then((response) => response.ok ? response.json() : null)
      .then((stats) => { if (stats) setConfirmedSubscribers(stats.confirmedSubscribers); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const readHashArticle = () => {
      const match = window.location.hash.match(/^#(?:story|read)=(.+)$/);
      const id = match ? decodeURIComponent(match[1]) : null;
      const authorMatch = window.location.hash.match(/^#author=(.+)$/);
      const authorId = authorMatch ? decodeURIComponent(authorMatch[1]) : null;
      setSelectedArticle(id ? articles.find((article) => article.id === id) || null : null);
      setSelectedAuthor(authorId ? authors.find((author) => author.id === authorId) || null : null);
    };
    readHashArticle();
    window.addEventListener('hashchange', readHashArticle);
    window.addEventListener('popstate', readHashArticle);
    return () => {
      window.removeEventListener('hashchange', readHashArticle);
      window.removeEventListener('popstate', readHashArticle);
    };
  }, [articles, authors]);

  useEffect(() => {
    const onSearch = (event) => setSearch(event.detail);
    window.addEventListener('site-search', onSearch);
    return () => window.removeEventListener('site-search', onSearch);
  }, []);

  const query = search.trim().toLowerCase();
  const countries = [...new Set(articles.flatMap((article) => article.countries || []))].sort();
  const matchesArticle = (article) => {
    const topics = article.topics || [];
    const matchesTopic = activeFilter === 'all' || article.category === activeFilter || topics.includes(activeFilter);
    const matchesCountry = countryFilter === 'all' || (article.countries || []).includes(countryFilter);
    const matchesSearch = !query || `${article.title} ${article.description} ${article.label} ${topics.join(' ')} ${(article.countries || []).join(' ')} ${JSON.stringify(article.metadata || {})}`.toLowerCase().includes(query);
    return matchesTopic && matchesCountry && matchesSearch;
  };
  const currentStories = articles.filter((article) => article.category !== 'archive' && matchesArticle(article));
  const archivedStories = articles.filter((article) => article.category === 'archive' && matchesArticle(article));
  const resetFilters = () => {
    setActiveFilter('all');
    setCountryFilter('all');
    setSearch('');
    window.dispatchEvent(new CustomEvent('site-search', { detail: '' }));
  };
  const openArticle = (article) => {
    window.history.pushState({}, '', `${window.location.pathname}${window.location.search}#story=${encodeURIComponent(article.id)}`);
    setSelectedArticle(article);
    setSelectedAuthor(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const openAuthor = (author) => {
    window.history.pushState({}, '', `${window.location.pathname}${window.location.search}#author=${encodeURIComponent(author.id)}`);
    setSelectedArticle(null);
    setSelectedAuthor(author);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const closeArticle = () => {
    if (window.location.hash.startsWith('#story=') || window.location.hash.startsWith('#read=') || window.location.hash.startsWith('#author=')) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#featured-articles`);
    }
    setSelectedArticle(null);
    setSelectedAuthor(null);
    window.requestAnimationFrame(() => document.getElementById('featured-articles')?.scrollIntoView({ behavior: 'smooth' }));
  };
  const coveredCountries = new Set(articles.filter((article) => article.category !== 'archive').flatMap((article) => article.countries || [])).size;

  if (studioOpen) return <EditorialStudio />;
  if (selectedAuthor) return <><Header /><AuthorProfilePage author={selectedAuthor} articles={articles} onBack={closeArticle} onOpen={openArticle} /><Footer siteSettings={siteSettings} /></>;
  if (selectedArticle) {
    const storyTopics = new Set(selectedArticle.topics || []);
    const storyCountries = new Set(selectedArticle.countries || []);
    const rankedStories = articles.filter((article) => article.id !== selectedArticle.id).map((article) => ({
      article,
      relevance: (article.topics || []).filter((topic) => storyTopics.has(topic)).length
        + (article.countries || []).filter((country) => storyCountries.has(country)).length
        + (article.category === selectedArticle.category ? 1 : 0),
    })).sort((left, right) => right.relevance - left.relevance);
    const relatedStories = rankedStories.filter((item) => item.relevance > 0);
    const relatedArticles = (relatedStories.length ? relatedStories : rankedStories).slice(0, 3).map((item) => item.article);
    const author = authors.find((profile) => profile.storyIds.includes(selectedArticle.id));
    return <><Header /><ArticlePage article={selectedArticle} author={author} relatedArticles={relatedArticles} onBack={closeArticle} onOpen={openArticle} onOpenAuthor={openAuthor} /><Footer siteSettings={siteSettings} /></>;
  }

  return <><Header /><main><Hero imageUrl={siteSettings.heroImageUrl} imageAlt={siteSettings.heroImageAlt} /><div aria-label="Tanzanian flag colors" className="tanzania-ribbon" role="img" /><FilterBar active={activeFilter} onChange={setActiveFilter} country={countryFilter} countries={countries} onCountryChange={setCountryFilter} search={search} onSearchChange={(value) => window.dispatchEvent(new CustomEvent('site-search', { detail: value }))} resultCount={currentStories.length + archivedStories.length} onReset={resetFilters} /><div id="deep-dives"><Featured articles={currentStories} authors={authors} onOpenAuthor={openAuthor} loading={loading} onReset={resetFilters} /></div><Partners /><Metrics stories={currentStories.length} countries={coveredCountries} subscribers={confirmedSubscribers} /><Archive articles={archivedStories} onOpen={openArticle} /><Newsletter /></main><Footer siteSettings={siteSettings} /></>;
}
