import { useEffect, useState } from 'react';

const pageSize = 50;
const initialData = { contacts: [], counts: { pending: 0, active: 0, unsubscribed: 0 }, page: 1, perPage: pageSize, total: 0 };

async function loadContacts({ search, status, page, perPage = pageSize }) {
  const params = new URLSearchParams({ search, status, page: String(page), perPage: String(perPage) });
  const response = await fetch(`/api/admin/newsletter/crm?${params}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not load newsletter contacts.');
  return result;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function NewsletterCRM() {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    loadContacts({ search: appliedSearch, status, page })
      .then(setData)
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [appliedSearch, status, page]);

  const pageCount = Math.max(1, Math.ceil(data.total / pageSize));

  async function exportContacts() {
    setExporting(true);
    setMessage('');
    try {
      const firstPage = await loadContacts({ search: appliedSearch, status, page: 1, perPage: 100 });
      const contacts = [...firstPage.contacts];
      const totalPages = Math.ceil(firstPage.total / firstPage.perPage);
      for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
        const next = await loadContacts({ search: appliedSearch, status, page: currentPage, perPage: 100 });
        contacts.push(...next.contacts);
      }
      const columns = ['email', 'status', 'country', 'interests', 'swahiliSummary', 'source', 'consentedAt', 'verifiedAt', 'welcomeSentAt', 'unsubscribedAt'];
      const rows = [columns, ...contacts.map((contact) => columns.map((column) => column === 'interests' ? (contact.interests || []).join('; ') : contact[column]))];
      const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
      const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'aztech-newsletter-contacts.csv';
      link.click();
      URL.revokeObjectURL(blobUrl);
      setMessage(`Exported ${contacts.length} contacts.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setExporting(false);
    }
  }

  return <section className="newsletter-crm">
    <header className="newsletter-crm-heading"><div><span>READER RELATIONSHIPS</span><h3>Newsletter CRM</h3><p>Subscriber status, preferences, consent, and welcome email delivery.</p></div><button className="studio-secondary" disabled={exporting || data.total === 0} onClick={exportContacts} type="button">{exporting ? 'Exporting...' : 'Export CSV'}</button></header>
    <div className="newsletter-crm-stats" aria-label="Subscriber totals">
      <article><span>Confirmed</span><strong>{data.counts.active.toLocaleString()}</strong></article>
      <article><span>Pending verification</span><strong>{data.counts.pending.toLocaleString()}</strong></article>
      <article><span>Unsubscribed</span><strong>{data.counts.unsubscribed.toLocaleString()}</strong></article>
    </div>
    <form className="newsletter-crm-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedSearch(search.trim()); }}>
      <label>Search contacts<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Email, country, or source" /></label>
      <label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="active">Confirmed</option><option value="pending">Pending verification</option><option value="unsubscribed">Unsubscribed</option></select></label>
      <button className="button button-orange" type="submit">Search</button>
    </form>
    <div className="newsletter-crm-table-wrap"><table className="newsletter-crm-table"><thead><tr><th>Email</th><th>Status</th><th>Country</th><th>Interests</th><th>Swahili</th><th>Source</th><th>Welcome email</th></tr></thead><tbody>
      {loading ? <tr><td colSpan="7">Loading contacts...</td></tr> : data.contacts.map((contact) => <tr key={contact.id || contact.email}><td>{contact.email}<small>Consent {contact.consentedAt ? new Date(contact.consentedAt).toLocaleDateString() : 'date unavailable'}</small></td><td><span className={`crm-status crm-status-${contact.status}`}>{contact.status === 'active' ? 'Confirmed' : contact.status === 'pending' ? 'Pending' : 'Unsubscribed'}</span></td><td>{contact.country || 'Tanzania'}</td><td>{contact.interests?.length ? contact.interests.join(', ') : 'None'}</td><td>{contact.swahiliSummary ? 'Yes' : 'No'}</td><td>{contact.source || '—'}</td><td>{contact.welcomeSentAt ? `Sent ${new Date(contact.welcomeSentAt).toLocaleDateString()}` : contact.status === 'active' ? 'Not recorded' : '—'}</td></tr>)}
      {!loading && data.contacts.length === 0 && <tr><td colSpan="7">No contacts match these filters.</td></tr>}
    </tbody></table></div>
    <footer className="newsletter-crm-pagination"><span>{data.total.toLocaleString()} contacts · Page {page} of {pageCount}</span><div><button className="studio-secondary" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Previous</button><button className="studio-secondary" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)} type="button">Next</button></div></footer>
    {message && <p className="studio-message" aria-live="polite">{message}</p>}
  </section>;
}