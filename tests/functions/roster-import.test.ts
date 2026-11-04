// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRosterCsv, toUpsertSql } from '../../scripts/lib/roster';

const header = 'passport_number,full_name,email,nationality,program,intake_term,status';

describe('parseRosterCsv', () => {
  it('parses and normalises good rows', () => {
    const r = parseRosterCsv(`${header}\n test0001 , Eyad Salem , S202368990@KFUPM.edu.sa ,,,,`);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { passport_number: 'TEST0001', full_name: 'Eyad Salem', email: 's202368990@kfupm.edu.sa', nationality: null, program: null, intake_term: null, status: 'active' },
    ]);
  });
  it('reports each bad row with its line number and keeps the good ones', () => {
    const r = parseRosterCsv(
      [header, 'A1,Too Short,a@b.co,,,,', 'TEST0003,Bad Mail,not-an-email,,,,', 'TEST0004,Good Row,ok@example.org,,,,', 'TEST0004,Dup,dup@example.org,,,,', 'TEST0006,Bad Status,s@example.org,,,,graduated'].join('\n'),
    );
    expect(r.rows.map((x) => x.passport_number)).toEqual(['TEST0004']);
    expect(r.errors).toEqual([
      'line 2: passport_number must be 5-20 letters and digits',
      'line 3: email is not valid',
      'line 5: duplicate passport_number TEST0004',
      'line 6: status must be active or withdrawn',
    ]);
  });
  it('rejects a file with the wrong header', () => {
    expect(parseRosterCsv('name,email\nx,y').errors[0]).toMatch(/header/);
  });
  it('reads the checked-in test roster: four students, the four supplied addresses', () => {
    const r = parseRosterCsv(readFileSync('data/roster.sample.csv', 'utf8'));
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.email)).toEqual(['s202368990@kfupm.edu.sa', 'eyadsalem139@gmail.com', 'sac@kfupm.edu.sa', 'anas.ammari@kfupm.edu.sa']);
    expect(r.rows.map((x) => x.passport_number)).toEqual(['TEST0001', 'TEST0002', 'TEST0003', 'TEST0004']);
  });
});

describe('toUpsertSql', () => {
  it('emits one parameter-free, quoted upsert per row (for wrangler d1 execute --file)', () => {
    const sql = toUpsertSql([{ passport_number: 'TEST0001', full_name: "O'Brien", email: 'a@b.co', nationality: null, program: null, intake_term: null, status: 'active' }]);
    expect(sql).toContain("INSERT INTO students");
    expect(sql).toContain("'O''Brien'"); // quotes escaped
    expect(sql).toContain('ON CONFLICT(passport_number) DO UPDATE');
    expect(sql).not.toMatch(/;\s*DROP|--/);
    expect(sql).not.toContain('phone');
  });
});
