import { createHash, randomBytes, scrypt, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const sessionDurationMs = 12 * 60 * 60 * 1000;
const localAuthPath = fileURLToPath(new URL('./data/editorial-users.json', import.meta.url));
const localArticlesPath = fileURLToPath(new URL('./data/editorial-articles.json', import.meta.url));

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function validProfileImageUrl(value) {
  return !value || /^https:\/\//i.test(value) || /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const key = await deriveKey(password, salt, 64);
  return { salt, hash: key.toString('hex') };
}

async function readLocalState(filePath = localAuthPath) {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error.code === 'ENOENT') return { users: [], sessions: [], setupTokens: [] };
    throw error;
  }
}

async function writeLocalState(state, filePath = localAuthPath) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2));
}

function publicUser(user) {
  return user ? {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name || user.displayName || '',
    title: user.title || '',
    bio: user.bio || '',
    avatarUrl: user.avatar_url || user.avatarUrl || '',
    xUrl: user.x_url || user.xUrl || '',
    linkedInUrl: user.linkedin_url || user.linkedInUrl || '',
    instagramUrl: user.instagram_url || user.instagramUrl || '',
    facebookUrl: user.facebook_url || user.facebookUrl || '',
    websiteUrl: user.website_url || user.websiteUrl || '',
  } : null;
}

function normalizeUserRecord(user) {
  return {
    ...user,
    display_name: typeof user.display_name === 'string' ? user.display_name : '',
    title: typeof user.title === 'string' ? user.title : '',
    bio: typeof user.bio === 'string' ? user.bio : '',
    avatar_url: typeof user.avatar_url === 'string' ? user.avatar_url : '',
    x_url: typeof user.x_url === 'string' ? user.x_url : '',
    linkedin_url: typeof user.linkedin_url === 'string' ? user.linkedin_url : '',
    instagram_url: typeof user.instagram_url === 'string' ? user.instagram_url : '',
    facebook_url: typeof user.facebook_url === 'string' ? user.facebook_url : '',
    website_url: typeof user.website_url === 'string' ? user.website_url : '',
    active: user.active !== false,
  };
}

function publicAuthor(user, storyIds) {
  return {
    id: user.id,
    displayName: user.display_name || '',
    title: user.title || '',
    bio: user.bio || '',
    avatarUrl: user.avatar_url || '',
    xUrl: user.x_url || '',
    linkedInUrl: user.linkedin_url || '',
    instagramUrl: user.instagram_url || '',
    facebookUrl: user.facebook_url || '',
    websiteUrl: user.website_url || '',
    storyIds,
  };
}

function normalizeProfileLinks(input, user) {
  const fields = {
    xUrl: 'x_url',
    linkedInUrl: 'linkedin_url',
    instagramUrl: 'instagram_url',
    facebookUrl: 'facebook_url',
    websiteUrl: 'website_url',
  };
  const values = {};
  for (const [field, column] of Object.entries(fields)) {
    const value = typeof input[field] === 'string' ? input[field].trim().slice(0, 2048) : user[column] || '';
    if (value) {
      let parsed;
      try { parsed = new URL(value); } catch {}
      if (parsed?.protocol !== 'https:' || !parsed.hostname) throw Object.assign(new Error('Profile links must use https URLs.'), { statusCode: 400 });
    }
    values[column] = value;
  }
  return values;
}

export function createAuthStore(pool, { filePath = localAuthPath, articlesFilePath = localArticlesPath } = {}) {
  if (!pool) {
    const readState = () => readLocalState(filePath);
    const writeState = (state) => writeLocalState(state, filePath);
    return {
      async initialize() {
        const isProduction = process.env.NODE_ENV === 'production';
        const email = (process.env.ADMIN_EMAIL || (isProduction ? '' : 'admin@aztechafrica.local')).trim().toLowerCase();
        const password = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'AztechAdmin123!');
        const state = await readState();

        const users = Array.isArray(state.users) ? state.users : [];
        const sessions = Array.isArray(state.sessions) ? state.sessions : [];
        const setupTokens = Array.isArray(state.setupTokens) ? state.setupTokens : [];

        if (email && password) {
          if (password.length < 6) throw new Error('ADMIN_PASSWORD must contain at least 6 characters.');
          let admin = users.find((user) => user.email === email);
          if (!admin) {
            const credentials = await hashPassword(password);
            admin = {
              id: randomUUID(),
              email,
              password_salt: credentials.salt,
              password_hash: credentials.hash,
              role: 'admin',
              active: true,
              display_name: 'AzTech Africa Admin',
              title: 'Editorial Team',
              bio: '',
              avatar_url: '',
              created_at: new Date().toISOString(),
            };
            users.push(admin);
          } else {
            const credentials = await hashPassword(password, admin.password_salt);
            admin.password_hash = credentials.hash;
            admin.role = 'admin';
            admin.active = true;
          }
        }

        await writeState({ users, sessions, setupTokens });
      },
      async login(emailInput, password) {
        const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
        if (!email || typeof password !== 'string' || password.length > 1024) return null;

        const state = await readState();
        const user = (state.users || []).find((entry) => entry.email === email);
        if (!user || user.active === false) return null;

        const candidate = await deriveKey(password, user.password_salt, 64);
        const expected = Buffer.from(user.password_hash, 'hex');
        if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return null;

        const token = randomBytes(32).toString('base64url');
        state.sessions = (state.sessions || []).filter((session) => session.user_id !== user.id && new Date(session.expires_at) > new Date());
        state.sessions.push({ token_hash: hashToken(token), user_id: user.id, expires_at: new Date(Date.now() + sessionDurationMs).toISOString() });
        await writeState(state);
        return { token, user: publicUser(normalizeUserRecord(user)) };
      },
      async getSession(token) {
        if (typeof token !== 'string' || token.length > 128) return null;
        const state = await readState();
        const session = (state.sessions || []).find((entry) => entry.token_hash === hashToken(token) && new Date(entry.expires_at) > new Date());
        if (!session) return null;
        const user = (state.users || []).find((entry) => entry.id === session.user_id && entry.active !== false);
        return user ? publicUser(normalizeUserRecord(user)) : null;
      },
      async logout(token) {
        if (typeof token !== 'string' || token.length > 128) return;
        const state = await readState();
        state.sessions = (state.sessions || []).filter((entry) => entry.token_hash !== hashToken(token));
        await writeState(state);
      },
      async listUsers() {
        const state = await readState();
        return (state.users || []).map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          active: user.active !== false,
          displayName: user.display_name || '',
          title: user.title || '',
          bio: user.bio || '',
          avatarUrl: user.avatar_url || '',
          xUrl: user.x_url || '',
          linkedInUrl: user.linkedin_url || '',
          instagramUrl: user.instagram_url || '',
          facebookUrl: user.facebook_url || '',
          websiteUrl: user.website_url || '',
          created_at: user.created_at,
        }));
      },
      async listPublicAuthors() {
        const [state, articleText] = await Promise.all([
          readState(),
          readFile(articlesFilePath, 'utf8').catch((error) => error.code === 'ENOENT' ? '[]' : Promise.reject(error)),
        ]);
        const articles = JSON.parse(articleText);
        const storiesByEmail = new Map();
        for (const article of articles) {
          if (article.status !== 'published') continue;
          const email = article.author_email || article.authorEmail;
          if (!email) continue;
          storiesByEmail.set(email, [...(storiesByEmail.get(email) || []), article.id]);
        }
        return (state.users || []).filter((user) => user.active !== false && storiesByEmail.has(user.email))
          .map((user) => publicAuthor(normalizeUserRecord(user), storiesByEmail.get(user.email)));
      },
      async createUser(emailInput, password, role) {
        const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { statusCode: 400 });
        if (!['author', 'admin'].includes(role)) throw Object.assign(new Error('Role must be author or admin.'), { statusCode: 400 });

        const invite = typeof password !== 'string' || !password;
        if (!invite && (password.length < 6 || password.length > 1024)) throw Object.assign(new Error('Set a password with at least 6 characters.'), { statusCode: 400 });

        const state = await readState();
        if ((state.users || []).some((user) => user.email === email)) {
          throw Object.assign(new Error('This account already exists.'), { statusCode: 409 });
        }

        const setupToken = invite ? randomBytes(32).toString('base64url') : null;
        const credentials = await hashPassword(invite ? randomBytes(48).toString('base64url') : password);
        const user = {
          id: randomUUID(),
          email,
          password_salt: credentials.salt,
          password_hash: credentials.hash,
          role,
          active: true,
          display_name: '',
          title: '',
          bio: '',
          avatar_url: '',
          x_url: '',
          linkedin_url: '',
          instagram_url: '',
          facebook_url: '',
          website_url: '',
          created_at: new Date().toISOString(),
        };

        state.users.push(user);
        if (setupToken) {
          state.setupTokens.push({ token_hash: hashToken(setupToken), user_id: user.id, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
        }
        await writeState(state);
        return { ...publicUser(normalizeUserRecord(user)), ...(setupToken ? { setupToken } : {}) };
      },
      async completePasswordSetup(token, password) {
        if (typeof token !== 'string' || token.length > 128 || typeof password !== 'string' || password.length < 12 || password.length > 1024) {
          throw Object.assign(new Error('Choose a password with at least 12 characters.'), { statusCode: 400 });
        }
        const state = await readState();
        const setupToken = (state.setupTokens || []).find((entry) => entry.token_hash === hashToken(token) && new Date(entry.expires_at) > new Date());
        if (!setupToken) throw Object.assign(new Error('This setup link is invalid or expired.'), { statusCode: 400 });
        const user = (state.users || []).find((entry) => entry.id === setupToken.user_id);
        if (!user) throw Object.assign(new Error('This setup link is invalid or expired.'), { statusCode: 400 });
        const credentials = await hashPassword(password);
        user.password_salt = credentials.salt;
        user.password_hash = credentials.hash;
        state.setupTokens = (state.setupTokens || []).filter((entry) => entry.token_hash !== hashToken(token));
        await writeState(state);
        return { updated: true };
      },
      async updateProfile(userId, input) {
        const state = await readState();
        const user = (state.users || []).find((entry) => entry.id === userId);
        if (!user) return null;
        user.display_name = typeof input.displayName === 'string' ? input.displayName.trim().slice(0, 100) : user.display_name || '';
        user.title = typeof input.title === 'string' ? input.title.trim().slice(0, 120) : user.title || '';
        user.bio = typeof input.bio === 'string' ? input.bio.trim().slice(0, 600) : user.bio || '';
        const avatarUrl = typeof input.avatarUrl === 'string' ? input.avatarUrl.trim() : '';
        if (!validProfileImageUrl(avatarUrl)) throw Object.assign(new Error('Profile image must use an https URL or an uploaded AzTech image.'), { statusCode: 400 });
        user.avatar_url = avatarUrl;
        Object.assign(user, normalizeProfileLinks(input, user));
        await writeState(state);
        return publicUser(normalizeUserRecord(user));
      },
      async setUserActive(userId, active, requestingUserId) {
        if (!active && userId === requestingUserId) throw Object.assign(new Error('You cannot disable your own account.'), { statusCode: 409 });
        const state = await readState();
        const user = (state.users || []).find((entry) => entry.id === userId);
        if (!user) return null;
        if (!active && user.active !== false && user.role === 'admin') {
          const admins = (state.users || []).filter((entry) => entry.role === 'admin' && entry.active !== false).length;
          if (admins <= 1) throw Object.assign(new Error('Keep at least one active admin account.'), { statusCode: 409 });
        }
        user.active = Boolean(active);
        await writeState(state);
        return { id: user.id, email: user.email, role: user.role, active: user.active, created_at: user.created_at };
      },
      async setUserRole(userId, role, requestingUserId) {
        if (!['author', 'admin'].includes(role)) throw Object.assign(new Error('Role must be author or admin.'), { statusCode: 400 });
        const state = await readLocalState();
        const user = (state.users || []).find((entry) => entry.id === userId);
        if (!user) return null;
        if (user.role === 'admin' && user.active !== false && role !== 'admin') {
          const admins = (state.users || []).filter((entry) => entry.role === 'admin' && entry.active !== false).length;
          if (admins <= 1) throw Object.assign(new Error('Keep at least one active admin account.'), { statusCode: 409 });
        }
        user.role = role;
        await writeLocalState(state);
        return { id: user.id, email: user.email, role: user.role, active: user.active, created_at: user.created_at };
      },
    };
  }

  return {
    async initialize() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS editorial_users (
          id UUID PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('author','admin')),
          active BOOLEAN NOT NULL DEFAULT TRUE,
          display_name TEXT NOT NULL DEFAULT '',
          title TEXT NOT NULL DEFAULT '',
          bio TEXT NOT NULL DEFAULT '',
          avatar_url TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query("ALTER TABLE editorial_users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE editorial_users ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE editorial_users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE editorial_users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE editorial_users ADD COLUMN IF NOT EXISTS x_url TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE editorial_users ADD COLUMN IF NOT EXISTS linkedin_url TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE editorial_users ADD COLUMN IF NOT EXISTS instagram_url TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE editorial_users ADD COLUMN IF NOT EXISTS facebook_url TEXT NOT NULL DEFAULT ''");
      await pool.query("ALTER TABLE editorial_users ADD COLUMN IF NOT EXISTS website_url TEXT NOT NULL DEFAULT ''");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS editorial_sessions (
          token_hash TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES editorial_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS editorial_sessions_expiry_idx ON editorial_sessions (expires_at)');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS editorial_password_setup_tokens (
          token_hash TEXT PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES editorial_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL
        )
      `);
      const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD;
      if (email && password) {
        if (password.length < 6) throw new Error('ADMIN_PASSWORD must contain at least 6 characters.');
        const credentials = await hashPassword(password);
        await pool.query(
          `INSERT INTO editorial_users (id,email,password_salt,password_hash,role)
           VALUES ($1,$2,$3,$4,'admin')
           ON CONFLICT (email) DO UPDATE SET password_salt=EXCLUDED.password_salt, password_hash=EXCLUDED.password_hash, role='admin', active=TRUE`,
          [randomUUID(), email, credentials.salt, credentials.hash],
        );
      }
    },
    async login(emailInput, password) {
      const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
      if (!email || typeof password !== 'string' || password.length > 1024) return null;
      const { rows } = await pool.query('SELECT id,email,password_salt,password_hash,role,active,display_name,title,bio,avatar_url,x_url,linkedin_url,instagram_url,facebook_url,website_url FROM editorial_users WHERE email=$1', [email]);
      const user = rows[0];
      if (!user || !user.active) return null;
      const candidate = await deriveKey(password, user.password_salt, 64);
      const expected = Buffer.from(user.password_hash, 'hex');
      if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return null;
      const token = randomBytes(32).toString('base64url');
      await pool.query('INSERT INTO editorial_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [hashToken(token), user.id, new Date(Date.now() + sessionDurationMs)]);
      return { token, user: publicUser(user) };
    },
    async getSession(token) {
      if (typeof token !== 'string' || token.length > 128) return null;
      const { rows } = await pool.query(
        `SELECT u.id,u.email,u.role,u.display_name AS "displayName",u.title,u.bio,u.avatar_url AS "avatarUrl",u.x_url AS "xUrl",u.linkedin_url AS "linkedInUrl",u.instagram_url AS "instagramUrl",u.facebook_url AS "facebookUrl",u.website_url AS "websiteUrl" FROM editorial_sessions s JOIN editorial_users u ON u.id=s.user_id
         WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.active=TRUE`,
        [hashToken(token)],
      );
      return rows[0] || null;
    },
    async listPublicAuthors() {
      const { rows } = await pool.query(
        `SELECT u.id,u.display_name,u.title,u.bio,u.avatar_url,u.x_url,u.linkedin_url,u.instagram_url,u.facebook_url,u.website_url,
          ARRAY_AGG(a.id ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC) AS story_ids
         FROM editorial_users u JOIN editorial_articles a ON a.author_email=u.email
         WHERE u.active=TRUE AND a.status='published'
         GROUP BY u.id ORDER BY u.display_name,u.id`,
      );
      return rows.map((user) => publicAuthor(user, user.story_ids || []));
    },
    async logout(token) {
      if (typeof token !== 'string' || token.length > 128) return;
      await pool.query('DELETE FROM editorial_sessions WHERE token_hash=$1', [hashToken(token)]);
    },
    async listUsers() {
      const { rows } = await pool.query('SELECT id,email,role,active,display_name AS "displayName",title,bio,avatar_url AS "avatarUrl",x_url AS "xUrl",linkedin_url AS "linkedInUrl",instagram_url AS "instagramUrl",facebook_url AS "facebookUrl",website_url AS "websiteUrl",created_at FROM editorial_users ORDER BY created_at');
      return rows;
    },
    async createUser(emailInput, password, role) {
      const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { statusCode: 400 });
      if (!['author', 'admin'].includes(role)) throw Object.assign(new Error('Role must be author or admin.'), { statusCode: 400 });
      const invite = typeof password !== 'string' || !password;
      if (!invite && (password.length < 6 || password.length > 1024)) throw Object.assign(new Error('Set a password with at least 6 characters.'), { statusCode: 400 });
      const setupToken = invite ? randomBytes(32).toString('base64url') : null;
      const credentials = await hashPassword(invite ? randomBytes(48).toString('base64url') : password);
      const { rows } = await pool.query(
        'INSERT INTO editorial_users (id,email,password_salt,password_hash,role) VALUES ($1,$2,$3,$4,$5) RETURNING id,email,role,active,display_name AS "displayName",title,bio,avatar_url AS "avatarUrl",x_url AS "xUrl",linkedin_url AS "linkedInUrl",instagram_url AS "instagramUrl",facebook_url AS "facebookUrl",website_url AS "websiteUrl",created_at',
        [randomUUID(), email, credentials.salt, credentials.hash, role],
      );
      if (setupToken) {
        await pool.query('INSERT INTO editorial_password_setup_tokens (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [hashToken(setupToken), rows[0].id, new Date(Date.now() + 24 * 60 * 60 * 1000)]);
      }
      return { ...rows[0], ...(setupToken ? { setupToken } : {}) };
    },
    async completePasswordSetup(token, password) {
      if (typeof token !== 'string' || token.length > 128 || typeof password !== 'string' || password.length < 12 || password.length > 1024) {
        throw Object.assign(new Error('Choose a password with at least 12 characters.'), { statusCode: 400 });
      }
      const { rows: tokens } = await pool.query('SELECT user_id FROM editorial_password_setup_tokens WHERE token_hash=$1 AND expires_at>NOW()', [hashToken(token)]);
      if (!tokens[0]) throw Object.assign(new Error('This setup link is invalid or expired.'), { statusCode: 400 });
      const credentials = await hashPassword(password);
      await pool.query('UPDATE editorial_users SET password_salt=$2,password_hash=$3 WHERE id=$1', [tokens[0].user_id, credentials.salt, credentials.hash]);
      await pool.query('DELETE FROM editorial_password_setup_tokens WHERE token_hash=$1', [hashToken(token)]);
      return { updated: true };
    },
    async updateProfile(userId, input) {
      const displayName = typeof input.displayName === 'string' ? input.displayName.trim().slice(0, 100) : '';
      const title = typeof input.title === 'string' ? input.title.trim().slice(0, 120) : '';
      const bio = typeof input.bio === 'string' ? input.bio.trim().slice(0, 600) : '';
      const avatarUrl = typeof input.avatarUrl === 'string' ? input.avatarUrl.trim().slice(0, 2048) : '';
      if (!validProfileImageUrl(avatarUrl)) throw Object.assign(new Error('Profile image must use an https URL or an uploaded AzTech image.'), { statusCode: 400 });
      const links = normalizeProfileLinks(input, {});
      const { rows } = await pool.query(
        'UPDATE editorial_users SET display_name=$2,title=$3,bio=$4,avatar_url=$5,x_url=$6,linkedin_url=$7,instagram_url=$8,facebook_url=$9,website_url=$10 WHERE id=$1 RETURNING id,email,role,active,display_name AS "displayName",title,bio,avatar_url AS "avatarUrl",x_url AS "xUrl",linkedin_url AS "linkedInUrl",instagram_url AS "instagramUrl",facebook_url AS "facebookUrl",website_url AS "websiteUrl",created_at',
        [userId, displayName, title, bio, avatarUrl, links.x_url, links.linkedin_url, links.instagram_url, links.facebook_url, links.website_url],
      );
      return rows[0] || null;
    },
    async setUserActive(userId, active, requestingUserId) {
      if (!active && userId === requestingUserId) throw Object.assign(new Error('You cannot disable your own account.'), { statusCode: 409 });
      const target = await pool.query('SELECT id,role,active FROM editorial_users WHERE id=$1', [userId]);
      if (!target.rows[0]) return null;
      if (!active && target.rows[0].active && target.rows[0].role === 'admin') {
        const admins = await pool.query("SELECT COUNT(*)::int AS count FROM editorial_users WHERE role='admin' AND active=TRUE");
        if (admins.rows[0].count <= 1) throw Object.assign(new Error('Keep at least one active admin account.'), { statusCode: 409 });
      }
      const { rows } = await pool.query('UPDATE editorial_users SET active=$2 WHERE id=$1 RETURNING id,email,role,active,created_at', [userId, active]);
      return rows[0] || null;
    },
    async setUserRole(userId, role, requestingUserId) {
      if (!['author', 'admin'].includes(role)) throw Object.assign(new Error('Role must be author or admin.'), { statusCode: 400 });
      const target = await pool.query('SELECT id,role,active FROM editorial_users WHERE id=$1', [userId]);
      if (!target.rows[0]) return null;
      if (target.rows[0].role === 'admin' && target.rows[0].active && role !== 'admin') {
        const admins = await pool.query("SELECT COUNT(*)::int AS count FROM editorial_users WHERE role='admin' AND active=TRUE");
        if (admins.rows[0].count <= 1) throw Object.assign(new Error('Keep at least one active admin account.'), { statusCode: 409 });
      }
      const { rows } = await pool.query('UPDATE editorial_users SET role=$2 WHERE id=$1 RETURNING id,email,role,active,created_at', [userId, role]);
      return rows[0] || null;
    },
  };
}
