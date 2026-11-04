/** Sign-in details used by the browser tests. Nothing is looked up: any well-formed pair signs in. */
export interface Creds {
  email: string;
  passport: string;
}

export const STUDENTS = {
  mai: { email: 'mai@example.com', passport: 'E2E00001' },
  mohammed: { email: 'mohammed@example.com', passport: 'N1234567' },
  /** The longest realistic address: 64-character local part, long domain. */
  longEmail: { email: 'bartholomew.fitzgerald.montgomery-wellington@northwind-industries-holdings.example.com', passport: 'A1B2C3D4E5F6G7H8I9J0' },
} satisfies Record<string, Creds>;
