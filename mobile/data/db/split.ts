/**
 * SQLite executes one statement per call, and FTS triggers contain
 * semicolons inside BEGIN…END — so split on the block boundary rather than
 * on every semicolon.
 *
 * Lives apart from ./index so it can be exercised without loading op-sqlite,
 * whose native module only exists inside the app.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inBlock = false;

  for (const rawLine of sql.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('--')) continue;

    buf += `${line}\n`;
    if (/\bBEGIN\b\s*$/i.test(line)) inBlock = true;

    if (inBlock) {
      if (/^END;?$/i.test(line)) {
        inBlock = false;
        out.push(buf.trim().replace(/;$/, ''));
        buf = '';
      }
      continue;
    }

    if (line.endsWith(';')) {
      out.push(buf.trim().replace(/;$/, ''));
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf.trim().replace(/;$/, ''));
  return out.filter(Boolean);
}
