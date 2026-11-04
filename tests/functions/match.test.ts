// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nameKey, namesMatch, normaliseEmail, normalisePassport } from '../../functions/lib/match';

describe('normalisePassport', () => {
  it('upper-cases and keeps letters and digits only', () => {
    expect(normalisePassport(' test-0001 ')).toBe('TEST0001');
    expect(normalisePassport('n١٢٣٤٥٦٧')).toBe('N1234567'); // Arabic-Indic digits
  });
});

describe('normaliseEmail', () => {
  it('lower-cases and trims', () => expect(normaliseEmail('  Mai@Example.COM ')).toBe('mai@example.com'));
});

describe('names', () => {
  it('keys a name into comparable tokens', () => {
    expect(nameKey('Mai Nguyễn')).toEqual(['mai', 'nguyen']);
    expect(nameKey("Seán O'Brien-Ó Súilleabháin")).toEqual(['sean', "o'brien", 'o', 'suilleabhain']);
    expect(nameKey('  SARA   AHMED  ')).toEqual(['sara', 'ahmed']);
  });
  it.each([
    ['Mai Nguyễn', 'NGUYEN THI MAI'],
    ['Sara Alqahtani', 'Sara Ahmed Alqahtani'],
    ['anas ammari', 'Anas Ammari'],
    ['Eyad Salem', 'Eyad Salem'],
    ['محمد عبدالله', 'عبدالله محمد'],
  ])('%s matches %s', (a, b) => expect(namesMatch(a, b)).toBe(true));
  it.each([
    ['Mai Nguyen', 'Mai Tran'],
    ['Sara', 'Sara Ahmed Alqahtani'], // one token is not enough when the roster has three
    ['Eyad Salem', 'Eyad Salim'],
    ['', 'Eyad Salem'],
  ])('%s does not match %s', (a, b) => expect(namesMatch(a, b)).toBe(false));
});
