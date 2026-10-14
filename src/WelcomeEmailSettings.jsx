import { useEffect, useState } from 'react';

const initialSettings = { enabled: true, subject: 'Welcome to AzTech Africa', body: '', emailDeliveryConfigured: false };

export default function WelcomeEmailSettings() {
  const [settings, setSettings] = useState(initialSettings);
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
  }

  useEffect(() => {
    request('/api/admin/newsletter/welcome').then(setSettings).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy('save');
    setMessage('');
    try {
      const updated = await request('/api/admin/newsletter/welcome', { method: 'PATCH', body: JSON.stringify(settings) });
      setSettings(updated);
      setMessage('Welcome email settings saved. These changes apply to future verified subscriptions.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  }

  async function sendTest() {
    if (!testEmail.trim()) {
      setMessage('Enter a test recipient email first.');
      return;
    }
    setBusy('test');
    setMessage('');
    try {
      await request('/api/admin/newsletter/welcome/test', { method: 'POST', body: JSON.stringify({ email: testEmail }) });
      setMessage(`Test welcome email sent to ${testEmail}.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  }

  if (loading) return <section className="welcome-email-settings"><p>Loading welcome email settings...</p></section>;
  return <section className="welcome-email-settings">
    <header className="newsletter-crm-heading"><div><span>ONBOARDING</span><h3>Welcome email</h3><p>Sent after a reader confirms their newsletter subscription.</p></div><span className={`welcome-delivery-status${settings.emailDeliveryConfigured ? ' is-ready' : ''}`}>{settings.emailDeliveryConfigured ? 'Email delivery ready' : 'Email delivery not configured'}</span></header>
    <form className="welcome-email-form" onSubmit={save}>
      <label className="welcome-email-toggle"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /><span><strong>Send welcome email after confirmation</strong><small>Only affects future confirmed subscriptions; it does not resend to existing contacts.</small></span></label>
      <label>Subject line<input maxLength="160" value={settings.subject} onChange={(event) => setSettings({ ...settings, subject: event.target.value })} required /></label>
      <label>Welcome message<textarea rows="8" maxLength="3000" value={settings.body} onChange={(event) => setSettings({ ...settings, body: event.target.value })} required /></label>
      <div className="welcome-email-actions"><button className="button button-orange" disabled={busy !== ''} type="submit">{busy === 'save' ? 'Saving...' : 'Save welcome email'}</button><label>Test recipient<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="editor@example.com" /></label><button className="studio-secondary" disabled={busy !== '' || !settings.emailDeliveryConfigured} onClick={sendTest} type="button">{busy === 'test' ? 'Sending...' : 'Send test'}</button></div>
    </form>
    {message && <p className="studio-message" aria-live="polite">{message}</p>}
  </section>;
}