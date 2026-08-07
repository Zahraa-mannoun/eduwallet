-- Enforces "at most one PENDING email change request per user" at the database level.
-- The application-level findFirst-then-create check in email-change.service.ts's
-- requestEmailChange() can't prevent two concurrent submissions from both passing the
-- check before either writes; this partial unique index is what actually closes that race.
CREATE UNIQUE INDEX "email_change_requests_one_pending_per_user"
  ON "email_change_requests" ("userId")
  WHERE "status" = 'PENDING';
