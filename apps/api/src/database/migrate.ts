import 'reflect-metadata';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createConnection, RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env.config';
export async function migrate() {
  const uri = new URL(env.DATABASE_URL);
  const connection = await createConnection({
    host: uri.hostname,
    port: Number(uri.port) || 3306,
    user: decodeURIComponent(uri.username),
    password: decodeURIComponent(uri.password),
    database: uri.pathname.slice(1),
    ...(env.DB_SSL ? { ssl: { rejectUnauthorized: true } } : {}),
  });
  try {
    const [rows] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('pt_academy_migrations',30) AS acquired");
    if (rows[0].acquired !== 1) throw new Error('Migration lock unavailable');
    await connection.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB',
    );
    const dir = path.resolve(__dirname, '../../migrations');
    for (const file of (await fs.readdir(dir)).filter((f) => /^\d+.*\.sql$/.test(f)).sort()) {
      const source = await fs.readFile(path.join(dir, file), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const [existing] = await connection.execute<RowDataPacket[]>(
        'SELECT checksum FROM schema_migrations WHERE name = ?',
        [file],
      );
      if (existing.length) {
        if (existing[0].checksum !== checksum) throw new Error(`Migration checksum changed: ${file}`);
        continue;
      }
      for (const statement of source
        .replace(/^--.*$/gm, '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await connection.query(statement);
      await connection.execute('INSERT INTO schema_migrations (name,checksum) VALUES (?,?)', [file, checksum]);
      console.log(`已套用 ${file}`);
    }
  } finally {
    await connection.query("SELECT RELEASE_LOCK('pt_academy_migrations')").catch(() => {});
    await connection.end();
  }
}
if (require.main === module)
  migrate().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Migration failed');
    process.exitCode = 1;
  });
