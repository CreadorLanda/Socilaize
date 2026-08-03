import { getDB } from './index';

/**
 * Key-value store for cryptographic material inside the encrypted database.
 *
 * SecureStore remains the right home for *small* secrets — notably the key
 * that opens this database. It is the wrong home for anything bulky: values
 * over 2048 bytes are not reliably stored, and the failure is a warning
 * rather than an exception, so the data simply is not there next launch.
 */

export async function getSecret(key: string): Promise<string | null> {
  const db = await getDB();
  const res = await db.execute('SELECT value FROM secrets WHERE key = ?', [key]);
  const row = res.rows?.[0] as { value?: string } | undefined;
  return row?.value ?? null;
}

export async function setSecret(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.execute(
    `INSERT INTO secrets (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function deleteSecret(key: string): Promise<void> {
  const db = await getDB();
  await db.execute('DELETE FROM secrets WHERE key = ?', [key]);
}
