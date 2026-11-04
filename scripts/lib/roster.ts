/** CSV → validated, normalised roster rows → SQL. Used by scripts/roster-import.ts and its tests. */
import { normaliseEmail, normalisePassport } from '../../functions/lib/match.ts';
import type { StudentRow } from '../../functions/lib/match.ts';

export const HEADER = ['passport_number', 'full_name', 'email', 'nationality', 'program', 'intake_term', 'status'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export function parseRosterCsv(text: string): { rows: StudentRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: StudentRow[] = [];
  const table = parseCsv(text.replace(/^\uFEFF/, ''));
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  if (header.join(',') !== HEADER.join(',')) {
    return { rows, errors: [`header must be exactly: ${HEADER.join(',')}`] };
  }
  const seen = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (k: (typeof HEADER)[number]) => (cells[HEADER.indexOf(k)] ?? '').trim();
    const passport = normalisePassport(get('passport_number'));
    const email = normaliseEmail(get('email'));
    const name = get('full_name').replace(/\s+/g, ' ');
    const status = (get('status') || 'active').toLowerCase();
    if (!/^[A-Z0-9]{5,20}$/.test(passport)) return errors.push(`line ${line}: passport_number must be 5-20 letters and digits`);
    if (!EMAIL.test(email)) return errors.push(`line ${line}: email is not valid`);
    if (name.length < 2 || name.length > 200) return errors.push(`line ${line}: full_name is missing or too long`);
    if (seen.has(passport)) return errors.push(`line ${line}: duplicate passport_number ${passport}`);
    if (status !== 'active' && status !== 'withdrawn') return errors.push(`line ${line}: status must be active or withdrawn`);
    seen.add(passport);
    rows.push({
      passport_number: passport,
      full_name: name,
      email,
      nationality: get('nationality') || null,
      program: get('program') || null,
      intake_term: get('intake_term') || null,
      status,
    });
    return undefined;
  });
  return { rows, errors };
}

const q = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`);

/** One upsert per row, as literal SQL for `wrangler d1 execute --file`. */
export function toUpsertSql(rows: StudentRow[]): string {
  return rows
    .map(
      (r) =>
        `INSERT INTO students (passport_number, full_name, email, nationality, program, intake_term, status) VALUES (${[
          q(r.passport_number),
          q(r.full_name),
          q(r.email),
          q(r.nationality),
          q(r.program),
          q(r.intake_term),
          q(r.status),
        ].join(', ')}) ON CONFLICT(passport_number) DO UPDATE SET full_name = excluded.full_name, email = excluded.email, nationality = excluded.nationality, program = excluded.program, intake_term = excluded.intake_term, status = excluded.status, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
    )
    .join('\n');
}
