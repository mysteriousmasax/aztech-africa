import { useEffect, useState } from 'react';

const periods = [7, 30, 90, 365];
const emptySummary = { totals: { pageViews: 0, storyViews: 0, completedReads: 0, clicks: 0 }, series: [], topArticles: [], topClicks: [] };
const numberFormatter = new Intl.NumberFormat();

export default function AnalyticsDashboard({ stories = [] }) {
  const [days, setDays] = useState(30);
  const [revision, setRevision] = useState(0);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`/api/admin/analytics?days=${days}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load site analytics.');
        return result;
      })
      .then((result) => { if (!cancelled) setSummary(result); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || 'Could not load site analytics.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, revision]);

  const totals = summary.totals || emptySummary.totals;
  const metrics = [
    ['Page views', totals.pageViews, 'page'],
    ['Story opens', totals.storyViews, 'story'],
    ['Completed reads', totals.completedReads, 'read'],
    ['Clicks', totals.clicks, 'click'],
  ];
  const bucketSize = days > 30 ? 7 : 1;
  const chartSeries = [];
  for (let index = 0; index < summary.series.length; index += bucketSize) {
    const bucket = summary.series.slice(index, index + bucketSize);
    chartSeries.push({
      date: bucket[0].date,
      pageViews: bucket.reduce((total, item) => total + item.pageViews, 0),
      storyViews: bucket.reduce((total, item) => total + item.storyViews, 0),
      completedReads: bucket.reduce((total, item) => total + item.completedReads, 0),
      clicks: bucket.reduce((total, item) => total + item.clicks, 0),
    });
  }
  const maxValue = Math.max(1, ...chartSeries.flatMap((item) => [item.pageViews, item.storyViews, item.completedReads, item.clicks]));
  const chartLabelInterval = Math.max(1, Math.ceil(chartSeries.length / 8));
  const articleTitles = new Map(stories.map((story) => [story.id, story.title || story.cardTitle || story.id]));
  const hasActivity = Object.values(totals).some((value) => value > 0);

  return <section className="site-analytics" aria-busy={loading}>
    <div className="analytics-toolbar">
      <p>Anonymous reader activity. Staff workspace activity and personal identifiers are not collected.</p>
      <div><label>Period<select value={days} onChange={(event) => setDays(Number(event.target.value))}>{periods.map((period) => <option key={period} value={period}>{period === 365 ? '12 months' : `${period} days`}</option>)}</select></label><button className="studio-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)} type="button">Refresh</button></div>
    </div>
    {error && <p className="studio-message" role="alert">{error}</p>}
    <div className="analytics-metrics" aria-label={`Site activity over the last ${days} days`}>
      {metrics.map(([label, value, kind]) => <article className={`analytics-metric analytics-metric-${kind}`} key={kind}><span>{label}</span><strong>{loading ? '...' : numberFormatter.format(value || 0)}</strong><small>Last {days === 365 ? '12 months' : `${days} days`}</small></article>)}
    </div>
    <section className="analytics-panel analytics-activity">
      <header><div><h3>Reader activity</h3><p>Daily page visits, story opens, completed reads, and clicks</p></div><span>{loading ? 'Updating' : hasActivity ? 'Tracking active' : 'No activity yet'}</span></header>
      {chartSeries.length > 0 ? <div className="analytics-chart-scroll"><div className="analytics-chart" role="img" aria-label={`${days > 30 ? 'Weekly' : 'Daily'} activity chart for the last ${days} days`}>
        {chartSeries.map((item, index) => <div className="analytics-day" key={item.date} title={`${item.date}: ${item.pageViews} page views, ${item.storyViews} story opens, ${item.completedReads} completed reads, ${item.clicks} clicks`}>
          <div className="analytics-bars">{[['page', item.pageViews], ['story', item.storyViews], ['read', item.completedReads], ['click', item.clicks]].map(([kind, value]) => <span className={`analytics-bar analytics-bar-${kind}`} key={kind} style={{ height: `${Math.max(value ? 4 : 0, (value / maxValue) * 100)}%` }} />)}</div>
          <small>{index % chartLabelInterval === 0 ? new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</small>
        </div>)}
      </div></div> : <p className="analytics-empty">Activity will appear here as readers visit and interact with the publication.</p>}
      <div className="analytics-legend"><span><i className="analytics-bar-page" />Page views</span><span><i className="analytics-bar-story" />Story opens</span><span><i className="analytics-bar-read" />Completed reads</span><span><i className="analytics-bar-click" />Clicks</span></div>
    </section>
    <div className="analytics-detail-grid">
      <section className="analytics-panel">
        <header><div><h3>Most-read stories</h3><p>By reader opens in this period</p></div></header>
        {summary.topArticles.length ? <ol className="analytics-ranking">{summary.topArticles.map((item) => <li key={item.contentId}><strong>{articleTitles.get(item.contentId) || item.contentId}</strong><span>{numberFormatter.format(item.views)} opens · {numberFormatter.format(item.completedReads)} completed reads</span></li>)}</ol> : <p className="analytics-empty">No story reads recorded yet.</p>}
      </section>
      <section className="analytics-panel">
        <header><div><h3>Most-clicked links</h3><p>Actions and destinations readers use most</p></div></header>
        {summary.topClicks.length ? <ol className="analytics-ranking">{summary.topClicks.map((item, index) => <li key={`${item.label}-${item.destination}-${index}`}><strong>{item.label || 'Unlabelled control'}</strong><span>{numberFormatter.format(item.clicks)} clicks{item.destination ? ` · ${item.destination}` : ''}</span></li>)}</ol> : <p className="analytics-empty">No link clicks recorded yet.</p>}
      </section>
    </div>
  </section>;
}
