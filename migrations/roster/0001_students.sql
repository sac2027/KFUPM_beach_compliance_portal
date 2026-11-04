-- Who may sign. Keyed by passport number: KFUPM has no student ID or university email before arrival.
CREATE TABLE IF NOT EXISTS students (
  passport_number TEXT PRIMARY KEY,          -- upper-case letters and digits only
  full_name       TEXT NOT NULL,             -- as printed in the passport
  phone_e164      TEXT NOT NULL,             -- +<country><number>
  email           TEXT NOT NULL,             -- the student's own address: where the PDF is sent
  nationality     TEXT,
  program         TEXT,
  intake_term     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- active | withdrawn
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS students_email ON students (email);
