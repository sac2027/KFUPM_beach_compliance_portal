-- The student's chosen nationality is recorded with the declaration; phone numbers are no longer collected.
ALTER TABLE submissions ADD COLUMN nationality TEXT;
ALTER TABLE submissions DROP COLUMN phone_e164;
