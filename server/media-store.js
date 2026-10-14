import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const maxImageBytes = 4 * 1024 * 1024;

const defaultDirectory = fileURLToPath(new URL('./data/uploads/', import.meta.url));
const supportedTypes = new Map([
  ['image/jpeg', { extension: 'jpg', signature: (data) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff }],
  ['image/png', { extension: 'png', signature: (data) => data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ['image/webp', { extension: 'webp', signature: (data) => data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' }],
]);

function detectImageType(data) {
  for (const [mimeType, type] of supportedTypes) {
    if (type.signature(data)) return [mimeType, type];
  }
  return null;
}

export function createMediaStore({ pool = null, directory = defaultDirectory } = {}) {
  return {
    async initialize() {
      if (!pool) return;
      await pool.query(`
        CREATE TABLE IF NOT EXISTS editorial_media (
          id UUID PRIMARY KEY,
          mime_type TEXT NOT NULL,
          data BYTEA NOT NULL,
          uploaded_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    },
    async save({ data, mimeType, uploadedBy }) {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
      if (!buffer.length) throw Object.assign(new Error('Choose an image file to upload.'), { statusCode: 400 });
      if (buffer.length > maxImageBytes) throw Object.assign(new Error('Images must be 4 MB or smaller.'), { statusCode: 413 });
      const detected = detectImageType(buffer);
      if (!detected || detected[0] !== mimeType) throw Object.assign(new Error('Use a valid JPEG, PNG, or WebP image.'), { statusCode: 400 });

      const id = randomUUID();
      if (pool) {
        await pool.query('INSERT INTO editorial_media (id,mime_type,data,uploaded_by) VALUES ($1,$2,$3,$4)', [id, detected[0], buffer, uploadedBy]);
      } else {
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, `${id}.${detected[1].extension}`), buffer, { flag: 'wx' });
      }
      return { id, url: `/api/media/${id}`, mimeType: detected[0] };
    },
    async get(id) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '')) return null;
      if (pool) {
        const { rows } = await pool.query('SELECT mime_type AS "mimeType",data FROM editorial_media WHERE id=$1', [id]);
        return rows[0] || null;
      }
      for (const [mimeType, type] of supportedTypes) {
        try {
          return { mimeType, data: await readFile(join(directory, `${id}.${type.extension}`)) };
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      return null;
    },
  };
}