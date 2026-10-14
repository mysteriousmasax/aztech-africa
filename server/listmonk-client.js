const requestTimeoutMs = 15_000;

export class ListmonkError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'ListmonkError';
    this.statusCode = statusCode;
  }
}

export function createListmonkClient({
  url = process.env.LISTMONK_URL,
  username = process.env.LISTMONK_API_USER,
  token = process.env.LISTMONK_API_TOKEN,
  fetchImpl = globalThis.fetch,
} = {}) {
  const baseUrl = typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '';
  const configured = Boolean(baseUrl && username && token);

  async function request(path, { method = 'GET', body } = {}) {
    if (!configured) throw new ListmonkError('Listmonk is not configured. Set LISTMONK_URL, LISTMONK_API_USER, and LISTMONK_API_TOKEN in Railway.', 503);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const raw = response.status === 204 ? '' : await response.text();
      let payload = {};
      if (raw) {
        try { payload = JSON.parse(raw); }
        catch { payload = { message: raw }; }
      }
      if (!response.ok) throw new ListmonkError(payload.message || `Listmonk request failed (${response.status}).`);
      return payload.data ?? payload;
    } catch (error) {
      if (error instanceof ListmonkError) throw error;
      throw new ListmonkError(error.name === 'AbortError' ? 'Listmonk did not respond in time.' : 'Unable to reach Listmonk. Check its URL and API service.');
    } finally {
      clearTimeout(timeout);
    }
  }

  async function lists() {
    const result = await request('/api/lists?status=active&per_page=all&minimal=true');
    return result.results || [];
  }

  async function campaigns() {
    const perPage = 100;
    const result = await request(`/api/campaigns?page=1&per_page=${perPage}&order_by=created_at&order=DESC&no_body=true`);
    const allCampaigns = [...(result.results || [])];
    const totalPages = Math.ceil((result.total || allCampaigns.length) / (result.per_page || perPage));
    for (let page = 2; page <= totalPages; page += 1) {
      const nextPage = await request(`/api/campaigns?page=${page}&per_page=${perPage}&order_by=created_at&order=DESC&no_body=true`);
      allCampaigns.push(...(nextPage.results || []));
    }
    return allCampaigns;
  }

  async function dashboard(activeSubscriberCount) {
    if (!configured) return { configured: false, activeSubscriberCount, lists: [], campaigns: [] };
    const [listResults, campaignResults] = await Promise.all([lists(), campaigns()]);
    return { configured: true, activeSubscriberCount, lists: listResults, campaigns: campaignResults };
  }

  function scheduleTimestamp(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      throw new ListmonkError('Choose a schedule time in the future.', 400);
    }
    return date.toISOString();
  }

  async function getCampaign(campaignId) {
    if (!String(campaignId || '').trim()) throw new ListmonkError('Choose a valid campaign.', 400);
    return request(`/api/campaigns/${encodeURIComponent(campaignId)}`);
  }

  async function setupAudience(audience = []) {
    const listName = 'AzTech Africa Weekly Brief';
    const currentLists = await lists();
    let list = currentLists.find((item) => item.name.trim().toLowerCase() === listName.toLowerCase());
    let created = false;
    if (!list) {
      list = await request('/api/lists', {
        method: 'POST',
        body: {
          name: listName,
          type: 'private',
          optin: 'single',
          status: 'active',
          tags: ['aztech-africa'],
          description: 'Confirmed AzTech Africa newsletter subscribers, synced from the publication preferences form.',
        },
      });
      created = true;
    }
    const sync = await syncAudience(audience, list.id);
    return { list, created, sync };
  }

  async function createCampaign(input) {
    const listId = Number(input.listId);
    if (!Number.isInteger(listId) || listId <= 0) throw new ListmonkError('Choose a valid mailing list.', 400);
    const listResults = await lists();
    if (!listResults.some((list) => Number(list.id) === listId)) throw new ListmonkError('That mailing list is unavailable or archived.', 400);
    const sendAt = scheduleTimestamp(input.sendAt);
    const payload = {
      name: input.name.trim(),
      subject: input.subject.trim(),
      lists: [listId],
      type: 'regular',
      content_type: 'html',
      body: input.body,
      tags: ['aztech-africa'],
      ...(input.fromEmail?.trim() ? { from_email: input.fromEmail.trim() } : {}),
      ...(sendAt ? { send_at: sendAt } : {}),
    };
    if (!payload.name || !payload.subject || !payload.body.trim()) throw new ListmonkError('Campaign name, subject, and email body are required.', 400);
    const campaign = await request('/api/campaigns', { method: 'POST', body: payload });
    if (sendAt) return request(`/api/campaigns/${campaign.id}/status`, { method: 'PUT', body: { status: 'scheduled' } });
    return campaign;
  }

  async function updateCampaign(campaignId, input) {
    const id = encodeURIComponent(campaignId);
    const existing = await getCampaign(campaignId);
    if (!['draft', 'scheduled'].includes(existing.status)) {
      throw new ListmonkError('Only draft or scheduled campaigns can be edited.', 409);
    }
    const listId = Number(input.listId);
    if (!Number.isInteger(listId) || listId <= 0) throw new ListmonkError('Choose a valid mailing list.', 400);
    const listResults = await lists();
    if (!listResults.some((list) => Number(list.id) === listId)) throw new ListmonkError('That mailing list is unavailable or archived.', 400);
    const sendAt = scheduleTimestamp(input.sendAt);
    const payload = {
      name: String(input.name || '').trim(),
      subject: String(input.subject || '').trim(),
      lists: [listId],
      type: existing.type || 'regular',
      content_type: existing.content_type || 'html',
      body: String(input.body || ''),
      tags: [...new Set([...(existing.tags || []), 'aztech-africa'])],
      ...(input.fromEmail?.trim() ? { from_email: input.fromEmail.trim() } : {}),
      ...(sendAt ? { send_at: sendAt } : {}),
    };
    if (!payload.name || !payload.subject || !payload.body.trim()) throw new ListmonkError('Campaign name, subject, and email body are required.', 400);
    const updated = await request(`/api/campaigns/${id}`, { method: 'PUT', body: payload });
    if (sendAt && existing.status !== 'scheduled') return request(`/api/campaigns/${id}/status`, { method: 'PUT', body: { status: 'scheduled' } });
    if (!sendAt && existing.status === 'scheduled') return request(`/api/campaigns/${id}/status`, { method: 'PUT', body: { status: 'draft' } });
    return updated;
  }

  async function sendTest(campaignId, email) {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new ListmonkError('Enter a valid test recipient email.', 400);
    }
    const campaign = await request(`/api/campaigns/${encodeURIComponent(campaignId)}`);
    const payload = {
      name: campaign.name,
      subject: campaign.subject,
      lists: (campaign.lists || []).map((list) => Number(list.id ?? list)),
      type: campaign.type || 'regular',
      content_type: campaign.content_type || 'html',
      body: campaign.body || '',
      subscribers: [email.trim()],
    };
    if (campaign.from_email) payload.from_email = campaign.from_email;
    if (campaign.altbody) payload.altbody = campaign.altbody;
    return request(`/api/campaigns/${encodeURIComponent(campaignId)}/test`, { method: 'POST', body: payload });
  }

  async function sendCampaign(campaignId, audience = []) {
    const campaignPath = `/api/campaigns/${encodeURIComponent(campaignId)}`;
    const campaign = await request(campaignPath);
    const listIds = [...new Set((campaign.lists || []).map((list) => Number(list.id ?? list)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!listIds.length) throw new ListmonkError('This campaign has no mailing list. Add a list before sending.', 400);
    if (campaign.status === 'scheduled') await request(`${campaignPath}/status`, { method: 'PUT', body: { status: 'draft' } });
    else if (campaign.status && !['draft', 'paused'].includes(campaign.status)) throw new ListmonkError('Only draft, paused, or scheduled campaigns can be sent now.', 409);
    for (const listId of listIds) await syncAudience(audience, listId);
    return request(`${campaignPath}/status`, { method: 'PUT', body: { status: 'running' } });
  }

  async function syncAudience(audience, listIdInput) {
    const listId = Number(listIdInput);
    if (!Number.isInteger(listId) || listId <= 0) throw new ListmonkError('Choose a valid mailing list.', 400);
    const listResults = await lists();
    if (!listResults.some((list) => Number(list.id) === listId)) throw new ListmonkError('That mailing list is unavailable or archived.', 400);
    const allSubscribers = [];
    const firstPage = await request('/api/subscribers?page=1&per_page=500');
    allSubscribers.push(...(firstPage.results || []));
    const pageCount = Math.ceil((firstPage.total || allSubscribers.length) / (firstPage.per_page || 500));
    for (let page = 2; page <= pageCount; page += 1) {
      const result = await request(`/api/subscribers?page=${page}&per_page=500`);
      allSubscribers.push(...(result.results || []));
    }
    const byEmail = new Map(allSubscribers.map((subscriber) => [subscriber.email.toLowerCase(), subscriber]));
    const result = { created: 0, updated: 0, unsubscribed: 0, skipped: 0 };

    for (const contact of audience) {
      const existing = byEmail.get(contact.email.toLowerCase());
      const membership = existing?.lists?.find((list) => Number(list.id) === listId);
      if (contact.status === 'unsubscribed') {
        if (existing && membership?.subscription_status === 'confirmed') {
          await request('/api/subscribers/lists', { method: 'PUT', body: { ids: [existing.id], action: 'unsubscribe', target_list_ids: [listId] } });
          result.unsubscribed += 1;
        }
        continue;
      }
      if (contact.status !== 'active') continue;
      if (existing?.status === 'blocklisted' || existing?.status === 'disabled' || membership?.subscription_status === 'unsubscribed') {
        result.skipped += 1;
        continue;
      }
      const attribs = { country: contact.country || 'Tanzania', interests: contact.interests || [], swahiliSummary: Boolean(contact.swahiliSummary) };
      if (!existing) {
        await request('/api/subscribers', {
          method: 'POST',
          body: { email: contact.email, name: contact.email.split('@')[0], status: 'enabled', lists: [listId], attribs, preconfirm_subscriptions: true },
        });
        result.created += 1;
        continue;
      }
      await request(`/api/subscribers/${existing.id}`, { method: 'PATCH', body: { attribs } });
      if (!membership || membership.subscription_status !== 'confirmed') {
        await request('/api/subscribers/lists', { method: 'PUT', body: { ids: [existing.id], action: 'add', target_list_ids: [listId], status: 'confirmed' } });
      }
      result.updated += 1;
    }
    return result;
  }

  return { configured, dashboard, createCampaign, getCampaign, updateCampaign, sendTest, sendCampaign, setupAudience, syncAudience };
}