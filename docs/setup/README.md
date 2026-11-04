# Dashboard-only setup SQL

Each file is one line per statement with no comments, so it can be pasted into the single-line **Console** of a D1 database
in the Cloudflare dashboard.

| File | Paste into | When |
| --- | --- | --- |
| `1-roster-tables.sql` | `pacf-roster` | Brand-new setup only |
| `2-records-tables.sql` | `pacf-records` | Brand-new setup only |
| `3-test-students.sql` | `pacf-roster` | Brand-new setup only (adds the four test students) |
| `4-update-roster-database.sql` | `pacf-roster` | **Existing setup**: once, to remove the phone-number column |
| `5-update-records-database.sql` | `pacf-records` | **Existing setup**: once, to add nationality and remove the phone-number column |

If you already created the databases with the first version of files 1 and 2, run only files 4 and 5 (once each). Running
them a second time reports "no such column", which is harmless.
