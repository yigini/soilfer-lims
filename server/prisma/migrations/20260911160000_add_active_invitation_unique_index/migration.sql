-- Add partial unique index on active pending email for StaffInvitation
-- In deployments with no conflicting duplicates, this creates the unique constraint cleanly.
-- In deployments with conflicting unconsumed duplicates, creating the index fails safely
-- without arbitrarily picking a rowid winner or mutating historical data without an audit record.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_staff_invitation_active_email"
ON "StaffInvitation" ("email")
WHERE "isConsumed" = 0 AND "isRevoked" = 0;
