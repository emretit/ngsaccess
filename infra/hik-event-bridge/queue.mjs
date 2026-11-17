import { mkdirSync, readdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Atomic, private spool records. Device tokens stay in the environment, never on disk. */
export function openSpool(directory) {
  if (!directory) return null;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  let sequence = 0;
  const syncDirectory = () => {
    const fd = openSync(directory, 'r');
    try { fsyncSync(fd); } finally { closeSync(fd); }
  };
  return {
    load() {
      return readdirSync(directory).filter(name => name.endsWith('.json')).sort().map(id => {
        const job = JSON.parse(readFileSync(join(directory, id), 'utf8'));
        if (!['/card-reader', '/hik-gateway/device-status'].includes(job.path) ||
            !job.body || typeof job.body !== 'object' || typeof job.tokenKey !== 'string') {
          throw new Error('Olay kuyruğu kaydı geçersiz; kayıt korunuyor');
        }
        return { ...job, id };
      });
    },
    put(job) {
      const id = `${Date.now()}-${String(sequence++).padStart(8, '0')}-${randomUUID()}.json`;
      const temporary = join(directory, `${id}.tmp`);
      const fd = openSync(temporary, 'wx', 0o600);
      try { writeFileSync(fd, JSON.stringify(job)); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temporary, join(directory, id));
      syncDirectory();
      return id;
    },
    remove(id) { unlinkSync(join(directory, id)); syncDirectory(); },
  };
}
