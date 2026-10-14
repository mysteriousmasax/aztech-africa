import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const localArticlesPath = fileURLToPath(new URL('./data/editorial-articles.json', import.meta.url));

async function readLocalArticles(filePath = localArticlesPath) {
  try {
    const text = await readFile(filePath, 'utf8');
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocalArticles(articles, filePath = localArticlesPath) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(articles, null, 2));
}

function normalizeLocalRecord(article) {
  return {
    id: article.id,
    slug: article.slug || article.id,
    category: article.category || 'roundup',
    label: article.label || 'Editorial',
    tag: article.tag || article.category || 'Story',
    read_time: article.read_time || article.readTime || '5 min read',
    title: article.title,
    card_title: article.card_title || article.cardTitle || article.title,
    description: article.description,
    date: article.date || 'Publication date pending',
    footer: article.footer || '',
    content: Array.isArray(article.content) ? article.content : [],
    countries: Array.isArray(article.countries) ? article.countries : [],
    topics: Array.isArray(article.topics) ? article.topics : [],
    status: article.status || 'draft',
    author_email: article.author_email || article.authorEmail || 'unknown@example.com',
    owner_email: article.owner_email || article.ownerEmail || '',
    reviewer_note: article.reviewer_note || article.reviewerNote || null,
    submitted_at: article.submitted_at || article.submittedAt || null,
    published_at: article.published_at || article.publishedAt || null,
    updated_at: article.updated_at || article.updatedAt || new Date().toISOString(),
    metadata: article.metadata || {},
    image_url: article.image_url || article.imageUrl || '',
    image_alt: article.image_alt || article.imageAlt || '',
    created_at: article.created_at || new Date().toISOString(),
  };
}

const articleColumns = `id, slug, category, label, tag, read_time, title, card_title, description, date, footer, content, countries, topics, status, author_email, owner_email, reviewer_note, submitted_at, published_at, updated_at, metadata, image_url, image_alt`;
const publicArticleColumns = articleColumns.split(', ').filter((column) => column !== 'owner_email').map((column) => `editorial_articles.${column}`).join(', ');

function toArticle(row) {
  return {
    ...row,
    readTime: row.read_time,
    cardTitle: row.card_title,
    countries: row.countries || [],
    topics: row.topics || [],
    content: row.content || [],
    metadata: row.metadata || {},
    imageUrl: row.image_url || '',
    imageAlt: row.image_alt || '',
    authorDisplayName: row.author_display_name || '',
    authorTitle: row.author_title || '',
    authorAvatarUrl: row.author_avatar_url || '',
    authorEmail: row.author_email,
    ownerEmail: row.owner_email || '',
    reviewerNote: row.reviewer_note,
    submittedAt: row.submitted_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

function normalizeImageUrl(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2048) throw Object.assign(new Error('Enter a valid image URL.'), { statusCode: 400 });
  const imageUrl = value.trim();
  if (imageUrl.startsWith('/') && !imageUrl.startsWith('//') && !imageUrl.includes('..')) return imageUrl;
  try {
    if (new URL(imageUrl).protocol === 'https:') return imageUrl;
  } catch {}
  throw Object.assign(new Error('Use an https image URL or a path inside the public site.'), { statusCode: 400 });
}

export function createEditorialStore(pool, seedArticles = [], { filePath = localArticlesPath, legacyOwnerEmail = 'makayaemmanuel42@gmail.com' } = {}) {
  if (!pool) {
    return {
      async initialize() {
        const existing = await readLocalArticles(filePath);
        const next = existing.map((article) => ({
          ...article,
          owner_email: article.owner_email || article.ownerEmail || legacyOwnerEmail,
        }));
        for (const article of seedArticles) {
          const index = next.findIndex((entry) => entry.id === article.id);
          const existingArticle = index >= 0 ? next[index] : null;
          const normalized = normalizeLocalRecord({
            ...existingArticle,
            ...article,
            status: existingArticle?.status || 'published',
            author_email: article.authorEmail || existingArticle?.author_email || 'AzTech Africa Editorial Team',
            owner_email: existingArticle?.owner_email || article.ownerEmail || legacyOwnerEmail,
            read_time: article.readTime,
            card_title: article.cardTitle,
            image_url: article.imageUrl,
            image_alt: article.imageAlt,
            metadata: article.metadata || {},
            published_at: existingArticle?.published_at || article.publishedAt || new Date().toISOString(),
          });
          if (index >= 0) next[index] = normalized; else next.push(normalized);
        }
        await writeLocalArticles(next, filePath);
      },
      async listPublished() {
        const articles = await readLocalArticles(filePath);
        return articles.filter((article) => article.status === 'published').map((article) => toArticle(normalizeLocalRecord(article)));
      },
      async listForUser(user) {
        const articles = await readLocalArticles(filePath);
        const allowed = user.role === 'admin' ? articles : articles.filter((article) => article.author_email === user.email);
        return allowed.map((article) => toArticle(normalizeLocalRecord(article)));
      },
      async getById(id) {
        const articles = await readLocalArticles(filePath);
        const article = articles.find((entry) => entry.id === id);
        return article ? toArticle(normalizeLocalRecord(article)) : null;
      },
      async saveDraft(body, user) {
        const id = body.id || randomUUID();
        const slug = (body.slug || body.title || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
        if (!slug || !body.title || !body.description) throw Object.assign(new Error('Title, slug, and summary are required.'), { statusCode: 400 });
        const articles = await readLocalArticles(filePath);
        const article = articles.find((entry) => entry.id === id);
        if (article && user.role !== 'admin' && article.owner_email !== user.email) throw Object.assign(new Error('You may only edit your own draft or returned story.'), { statusCode: 403 });
        const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};
        const imageUrl = normalizeImageUrl(body.imageUrl || '');
        const draft = normalizeLocalRecord({
          ...article,
          id,
          slug,
          category: body.category || article?.category || 'roundup',
          label: body.label || article?.label || 'Editorial',
          tag: body.tag || article?.tag || body.category || 'Story',
          read_time: body.readTime || article?.read_time || '5 min read',
          title: body.title,
          card_title: body.cardTitle || body.title,
          description: body.description,
          date: body.date || article?.date || 'Publication date pending',
          footer: body.footer || article?.footer || '',
          content: Array.isArray(body.content) ? body.content : article?.content || [],
          countries: Array.isArray(body.countries) ? body.countries : article?.countries || [],
          topics: Array.isArray(body.topics) ? body.topics : article?.topics || [],
          metadata,
          status: article && (user.role === 'admin' || ['draft', 'needs_edits'].includes(article.status)) ? article.status : 'draft',
          author_email: article?.author_email || user.email,
          owner_email: article?.owner_email || user.email,
          reviewer_note: article?.reviewer_note || null,
          submitted_at: article?.submitted_at || null,
          published_at: article?.published_at || null,
          updated_at: new Date().toISOString(),
          image_url: imageUrl,
          image_alt: typeof body.imageAlt === 'string' ? body.imageAlt.trim().slice(0, 300) : article?.image_alt || '',
        });

        if (article) {
          const index = articles.findIndex((entry) => entry.id === id);
          articles[index] = draft;
        } else {
          articles.push(draft);
        }
          await writeLocalArticles(articles, filePath);
        return toArticle(normalizeLocalRecord(draft));
      },
      async submitForReview(id, user) {
        const articles = await readLocalArticles(filePath);
        const article = articles.find((entry) => entry.id === id);
        if (!article || article.author_email !== user.email || !['draft', 'needs_edits'].includes(article.status)) return null;
        article.status = 'in_review';
        article.submitted_at = new Date().toISOString();
        article.reviewer_note = null;
        article.updated_at = new Date().toISOString();
        await writeLocalArticles(articles, filePath);
        return toArticle(normalizeLocalRecord(article));
      },
      async review(id, action, note = '') {
        const articles = await readLocalArticles(filePath);
        const article = articles.find((entry) => entry.id === id && entry.status === 'in_review');
        if (!article) return null;
        article.status = action === 'publish' ? 'published' : 'needs_edits';
        article.reviewer_note = note || null;
        if (action === 'publish') article.published_at = new Date().toISOString();
        article.updated_at = new Date().toISOString();
        await writeLocalArticles(articles, filePath);
        return toArticle(normalizeLocalRecord(article));
      },
      async setStatus(id, status) {
        if (!['published', 'archived'].includes(status)) return null;
        const articles = await readLocalArticles(filePath);
        const article = articles.find((entry) => entry.id === id);
        if (!article) return null;
        article.status = status;
        if (status === 'published' && !article.published_at) article.published_at = new Date().toISOString();
        article.updated_at = new Date().toISOString();
        await writeLocalArticles(articles, filePath);
        return toArticle(normalizeLocalRecord(article));
      },
      async deleteById(id) {
        const articles = await readLocalArticles(filePath);
        const remaining = articles.filter((article) => article.id !== id);
        if (remaining.length === articles.length) return false;
        await writeLocalArticles(remaining, filePath);
        return true;
      },
    };
  }

  return {
    async initialize() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS editorial_articles (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL,
          label TEXT NOT NULL,
          tag TEXT NOT NULL,
          read_time TEXT NOT NULL,
          title TEXT NOT NULL,
          card_title TEXT NOT NULL,
          description TEXT NOT NULL,
          date TEXT NOT NULL,
          footer TEXT NOT NULL DEFAULT '',
          content JSONB NOT NULL DEFAULT '[]'::jsonb,
          countries TEXT[] NOT NULL DEFAULT '{}',
          topics TEXT[] NOT NULL DEFAULT '{}',
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          image_url TEXT NOT NULL DEFAULT '',
          image_alt TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL CHECK (status IN ('draft','in_review','needs_edits','published','archived')),
          author_email TEXT NOT NULL,
          owner_email TEXT NOT NULL,
          reviewer_note TEXT,
          submitted_at TIMESTAMPTZ,
          published_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query("ALTER TABLE editorial_articles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb");
      await pool.query("ALTER TABLE editorial_articles ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE editorial_articles ADD COLUMN IF NOT EXISTS image_alt TEXT NOT NULL DEFAULT ''");
      await pool.query('ALTER TABLE editorial_articles ADD COLUMN IF NOT EXISTS owner_email TEXT');
      await pool.query("UPDATE editorial_articles SET owner_email=$1 WHERE owner_email IS NULL OR owner_email=''", [legacyOwnerEmail]);
      await pool.query('ALTER TABLE editorial_articles ALTER COLUMN owner_email SET NOT NULL');
      await pool.query('CREATE INDEX IF NOT EXISTS editorial_articles_status_updated_idx ON editorial_articles (status, updated_at DESC)');
      for (const article of seedArticles) {
        await pool.query(
          `INSERT INTO editorial_articles (${articleColumns})
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,'published','AzTech Africa Editorial Team',$15,NULL,NULL,$16,NOW(),$17::jsonb,$18,$19)
           ON CONFLICT (id) DO UPDATE SET
             image_url = CASE WHEN editorial_articles.image_url = '' THEN EXCLUDED.image_url ELSE editorial_articles.image_url END,
             image_alt = CASE WHEN editorial_articles.image_url = '' THEN EXCLUDED.image_alt ELSE editorial_articles.image_alt END`,
          [article.id, article.id, article.category, article.label, article.tag, article.readTime, article.title, article.cardTitle, article.description, article.date, article.footer || '', JSON.stringify(article.content || []), article.countries || [], article.topics || [], legacyOwnerEmail, new Date(), JSON.stringify(article.metadata || {}), article.imageUrl || '', article.imageAlt || ''],
        );
      }
    },
    async listPublished() {
      const { rows } = await pool.query(`SELECT ${publicArticleColumns}, u.display_name AS author_display_name, u.title AS author_title, u.avatar_url AS author_avatar_url FROM editorial_articles LEFT JOIN editorial_users u ON u.email=editorial_articles.author_email WHERE editorial_articles.status = 'published' ORDER BY editorial_articles.published_at DESC NULLS LAST, editorial_articles.created_at DESC`);
      return rows.map(toArticle);
    },
    async listForUser(user) {
      const admin = user.role === 'admin';
      const { rows } = await pool.query(
        `SELECT ${articleColumns} FROM editorial_articles ${admin ? '' : 'WHERE author_email = $1'} ORDER BY updated_at DESC`,
        admin ? [] : [user.email],
      );
      return rows.map(toArticle);
    },
    async getById(id) {
      const { rows } = await pool.query(`SELECT ${articleColumns} FROM editorial_articles WHERE id = $1`, [id]);
      return rows[0] ? toArticle(rows[0]) : null;
    },
    async saveDraft(body, user) {
      const id = body.id || randomUUID();
      const slug = (body.slug || body.title || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
      if (!slug || !body.title || !body.description) throw Object.assign(new Error('Title, slug, and summary are required.'), { statusCode: 400 });
      const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};
      const imageUrl = normalizeImageUrl(body.imageUrl || '');
      const imageAlt = typeof body.imageAlt === 'string' ? body.imageAlt.trim().slice(0, 300) : '';
      const values = [id, slug, body.category || 'roundup', body.label || 'Editorial', body.tag || body.category || 'Story', body.readTime || '5 min read', body.title, body.cardTitle || body.title, body.description, body.date || 'Publication date pending', body.footer || '', JSON.stringify(Array.isArray(body.content) ? body.content : []), Array.isArray(body.countries) ? body.countries : [], Array.isArray(body.topics) ? body.topics : [], JSON.stringify(metadata), user.email, user.email, imageUrl, imageAlt, user.role];
      const { rows } = await pool.query(
        `INSERT INTO editorial_articles (id,slug,category,label,tag,read_time,title,card_title,description,date,footer,content,countries,topics,metadata,status,author_email,owner_email,image_url,image_alt)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15::jsonb,'draft',$16,$17,$18,$19)
         ON CONFLICT (id) DO UPDATE SET slug=$2, category=$3, label=$4, tag=$5, read_time=$6, title=$7, card_title=$8, description=$9, date=$10, footer=$11, content=$12::jsonb, countries=$13, topics=$14, metadata=$15::jsonb, image_url=$18, image_alt=$19, status=CASE WHEN $20::text='admin' THEN editorial_articles.status WHEN editorial_articles.status='needs_edits' THEN 'draft' ELSE editorial_articles.status END, updated_at=NOW()
         WHERE editorial_articles.id=$1 AND ($20::text='admin' OR editorial_articles.owner_email=$16) AND (editorial_articles.status IN ('draft','needs_edits') OR $20::text='admin')
         RETURNING ${articleColumns}`,
        values,
      );
      if (!rows[0]) throw Object.assign(new Error('You may only edit your own draft or returned story.'), { statusCode: 403 });
      return toArticle(rows[0]);
    },
    async submitForReview(id, user) {
      const { rows } = await pool.query(`UPDATE editorial_articles SET status='in_review', submitted_at=NOW(), reviewer_note=NULL, updated_at=NOW() WHERE id=$1 AND author_email=$2 AND status IN ('draft','needs_edits') RETURNING ${articleColumns}`, [id, user.email]);
      return rows[0] ? toArticle(rows[0]) : null;
    },
    async review(id, action, note = '') {
      const status = action === 'publish' ? 'published' : 'needs_edits';
      const { rows } = await pool.query(`UPDATE editorial_articles SET status=$2, reviewer_note=$3, published_at=CASE WHEN $2='published' THEN NOW() ELSE published_at END, updated_at=NOW() WHERE id=$1 AND status='in_review' RETURNING ${articleColumns}`, [id, status, note || null]);
      return rows[0] ? toArticle(rows[0]) : null;
    },
    async setStatus(id, status) {
      if (!['published', 'archived'].includes(status)) return null;
      const { rows } = await pool.query(
        `UPDATE editorial_articles SET status=$2, published_at=CASE WHEN $2='published' THEN COALESCE(published_at,NOW()) ELSE published_at END, updated_at=NOW() WHERE id=$1 RETURNING ${articleColumns}`,
        [id, status],
      );
      return rows[0] ? toArticle(rows[0]) : null;
    },
    async deleteById(id) {
      const result = await pool.query('DELETE FROM editorial_articles WHERE id=$1 RETURNING id', [id]);
      return result.rowCount > 0;
    },
  };
}
