-- Drop unique index on email in employee_credentials (allow duplicate emails)
DROP INDEX IF EXISTS "employee_creds_email_uq";
-- Recreate as non-unique index
CREATE INDEX IF NOT EXISTS "employee_creds_email_idx" ON "employee_credentials" ("email");
