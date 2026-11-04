/** Credentials that exist in the local test roster (data/roster.sample.csv + data/roster.e2e.csv). */
export interface Creds {
  name: string;
  email: string;
  /** ISO code chosen in the Nationality dropdown. It is recorded, not checked. */
  nationality: string;
  passport: string;
}

export const STUDENTS = {
  /** The user's own test entries (data/roster.sample.csv). */
  eyad: { name: 'Eyad Salem', email: 's202368990@kfupm.edu.sa', nationality: 'SA', passport: 'TEST0001' },
  anas: { name: 'Anas Ammari', email: 'anas.ammari@kfupm.edu.sa', nationality: 'TN', passport: 'TEST0004' },
  /** Test-only rows (data/roster.e2e.csv). */
  mai: { name: 'Mai Nguyễn', email: 'eyadsalem139@gmail.com', nationality: 'VN', passport: 'E2E00001' }, // roster: "Nguyen Thi Mai"
  mohammed: { name: 'Mohammed Alghamdi', email: 'eyadsalem139@gmail.com', nationality: 'SA', passport: 'E2E00002' },
  longName: { name: 'Abdulrahman Alghamdi', email: 'eyadsalem139@gmail.com', nationality: 'SA', passport: 'E2E00003' },
  persian: { name: 'Nameh Ahmadi', email: 'eyadsalem139@gmail.com', nationality: 'IR', passport: 'E2E00004' },
  withdrawn: { name: 'Withdrawn Student', email: 'eyadsalem139@gmail.com', nationality: 'SA', passport: 'E2E00005' },
} satisfies Record<string, Creds>;
