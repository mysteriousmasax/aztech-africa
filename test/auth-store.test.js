import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAuthStore } from '../server/auth-store.js';

test('hashes staff passwords and issues revocable role-bearing sessions', async () => {
  const users = new Map();
  const sessions = new Map();
  const setupTokens = new Map();
  const pool = {
    async query(sql, values = []) {
      if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX') || sql.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO editorial_users')) {
        const [id, email, passwordSalt, passwordHash, role] = values;
        const user = { id, email, password_salt: passwordSalt, password_hash: passwordHash, role, active: true, display_name: '', title: '', bio: '', avatar_url: '', x_url: '', linkedin_url: '', instagram_url: '', facebook_url: '', website_url: '', created_at: new Date().toISOString() };
        users.set(email, user);
        return { rows: [{ id, email, role, active: true, displayName: '', title: '', bio: '', avatarUrl: '', created_at: user.created_at }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO editorial_password_setup_tokens')) {
        setupTokens.set(values[0], { user_id: values[1], expires_at: values[2] });
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('SELECT user_id FROM editorial_password_setup_tokens')) {
        const token = setupTokens.get(values[0]);
        return { rows: token ? [{ user_id: token.user_id }] : [], rowCount: token ? 1 : 0 };
      }
      if (sql.includes('UPDATE editorial_users SET password_salt')) {
        const user = [...users.values()].find((item) => item.id === values[0]);
        user.password_salt = values[1];
        user.password_hash = values[2];
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('DELETE FROM editorial_password_setup_tokens')) return { rows: [], rowCount: setupTokens.delete(values[0]) ? 1 : 0 };
      if (sql.includes('UPDATE editorial_users SET display_name')) {
        const user = [...users.values()].find((item) => item.id === values[0]);
        Object.assign(user, { display_name: values[1], title: values[2], bio: values[3], avatar_url: values[4], x_url: values[5], linkedin_url: values[6], instagram_url: values[7], facebook_url: values[8], website_url: values[9] });
        return { rows: [{ id: user.id, email: user.email, role: user.role, active: user.active, displayName: user.display_name, title: user.title, bio: user.bio, avatarUrl: user.avatar_url, xUrl: user.x_url, linkedInUrl: user.linkedin_url, instagramUrl: user.instagram_url, facebookUrl: user.facebook_url, websiteUrl: user.website_url, created_at: user.created_at }], rowCount: 1 };
      }
      if (sql.includes('FROM editorial_users u JOIN editorial_articles a')) {
        const user = [...users.values()].find((item) => item.email === 'writer@example.com');
        return { rows: user ? [{ ...user, story_ids: ['published-story'] }] : [], rowCount: user ? 1 : 0 };
      }
      if (sql.includes('SELECT id,email,password_salt')) return { rows: users.has(values[0]) ? [users.get(values[0])] : [], rowCount: users.has(values[0]) ? 1 : 0 };
      if (sql.includes('INSERT INTO editorial_sessions')) {
        sessions.set(values[0], { user_id: values[1], expires_at: values[2] });
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM editorial_sessions s JOIN editorial_users')) {
        const session = sessions.get(values[0]);
        const user = [...users.values()].find((item) => item.id === session?.user_id);
        return { rows: session && user ? [{ id: user.id, email: user.email, role: user.role, displayName: user.display_name, title: user.title, bio: user.bio, avatarUrl: user.avatar_url, xUrl: user.x_url, linkedInUrl: user.linkedin_url, instagramUrl: user.instagram_url, facebookUrl: user.facebook_url, websiteUrl: user.website_url }] : [], rowCount: session && user ? 1 : 0 };
      }
      if (sql.includes('DELETE FROM editorial_sessions')) {
        return { rows: [], rowCount: sessions.delete(values[0]) ? 1 : 0 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const auth = createAuthStore(pool);
  await auth.initialize();
  await assert.rejects(auth.createUser('TooShort@example.com', '12345', 'author'), /at least 6 characters/);
  await auth.createUser('Editor@example.com', 'six123', 'admin');
  assert.equal(await auth.login('editor@example.com', 'wrong-password'), null);
  const session = await auth.login('EDITOR@example.com', 'six123');
  assert.equal(session.user.role, 'admin');
  assert.deepEqual(await auth.getSession(session.token), session.user);
  await auth.logout(session.token);
  assert.equal(await auth.getSession(session.token), null);

  const invited = await auth.createUser('writer@example.com', undefined, 'author');
  assert.ok(invited.setupToken);
  await assert.rejects(auth.completePasswordSetup(invited.setupToken, 'short'), /at least 12 characters/);
  await auth.completePasswordSetup(invited.setupToken, 'a-strong-setup-password');
  await assert.rejects(auth.completePasswordSetup(invited.setupToken, 'a-strong-setup-password'), /invalid or expired/);
  assert.equal((await auth.login('writer@example.com', 'a-strong-setup-password')).user.role, 'author');
  const profile = await auth.updateProfile(invited.id, { displayName: 'Writer Name', title: 'Editor', bio: 'Covers regional technology.', avatarUrl: '/api/media/11111111-1111-4111-8111-111111111111', xUrl: 'https://x.com/writer', linkedInUrl: 'https://linkedin.com/in/writer', instagramUrl: 'https://instagram.com/writer', facebookUrl: 'https://facebook.com/writer', websiteUrl: 'https://writer.example.com' });
  assert.equal(profile.displayName, 'Writer Name');
  assert.equal(profile.avatarUrl, '/api/media/11111111-1111-4111-8111-111111111111');
  assert.equal(profile.linkedInUrl, 'https://linkedin.com/in/writer');
  assert.deepEqual(await auth.listPublicAuthors(), [{ id: invited.id, displayName: 'Writer Name', title: 'Editor', bio: 'Covers regional technology.', avatarUrl: '/api/media/11111111-1111-4111-8111-111111111111', xUrl: 'https://x.com/writer', linkedInUrl: 'https://linkedin.com/in/writer', instagramUrl: 'https://instagram.com/writer', facebookUrl: 'https://facebook.com/writer', websiteUrl: 'https://writer.example.com', storyIds: ['published-story'] }]);
  await assert.rejects(auth.updateProfile(invited.id, { websiteUrl: 'javascript:alert(1)' }), /https URLs/);
});

test('supports a local file-based fallback when no PostgreSQL pool is configured', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-auth-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const articlesFilePath = join(directory, 'articles.json');
  const auth = createAuthStore(null, { filePath: join(directory, 'users.json'), articlesFilePath });
  await auth.initialize();

  await auth.createUser('local-author@example.com', 'LocalPassword123', 'author');
  const session = await auth.login('local-author@example.com', 'LocalPassword123');

  assert.ok(session);
  assert.equal(session.user.email, 'local-author@example.com');
  assert.equal((await auth.getSession(session.token))?.role, 'author');
  await auth.updateProfile(session.user.id, { displayName: 'Local Writer', avatarUrl: 'https://images.example.com/writer.jpg', xUrl: 'https://x.com/local-writer' });
  await writeFile(articlesFilePath, JSON.stringify([
    { id: 'published-story', author_email: session.user.email, status: 'published' },
    { id: 'private-draft', author_email: session.user.email, status: 'draft' },
  ]));
  const [author] = await auth.listPublicAuthors();
  assert.equal(author.displayName, 'Local Writer');
  assert.equal(author.avatarUrl, 'https://images.example.com/writer.jpg');
  assert.equal(author.xUrl, 'https://x.com/local-writer');
  assert.deepEqual(author.storyIds, ['published-story']);
});
