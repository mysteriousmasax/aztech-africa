import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createMediaStore, maxImageBytes } from '../server/media-store.js';

const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test('stores and reads validated local media uploads', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'aztech-media-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const media = createMediaStore({ directory });
  const uploaded = await media.save({ data: pngData, mimeType: 'image/png', uploadedBy: 'editor@example.test' });
  const stored = await media.get(uploaded.id);

  assert.equal(uploaded.mimeType, 'image/png');
  assert.equal(uploaded.url, `/api/media/${uploaded.id}`);
  assert.equal(stored.mimeType, 'image/png');
  assert.deepEqual(stored.data, pngData);
  await assert.rejects(media.save({ data: pngData, mimeType: 'image/jpeg', uploadedBy: 'editor@example.test' }), /valid JPEG, PNG, or WebP/);
  await assert.rejects(media.save({ data: Buffer.alloc(maxImageBytes + 1), mimeType: 'image/png', uploadedBy: 'editor@example.test' }), /4 MB or smaller/);
});