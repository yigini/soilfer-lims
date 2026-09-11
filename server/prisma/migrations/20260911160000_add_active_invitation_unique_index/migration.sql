-- Explicit normalization of any existing duplicate pending invitations before creating unique index
-- In intermediate duplicate states, retain the latest unconsumed/unrevoked invitation per email and mark older duplicates as revoked
UPDATE "StaffInvitation"
SET "isRevoked" = 1
WHERE "isConsumed" = 0 AND "isRevoked" = 0
  AND "id" NOT IN (
    SELECT "id" FROM "StaffInvitation" s1
    WHERE s1."isConsumed" = 0 AND s1."isRevoked" = 0
      AND s1."rowid" = (
        SELECT max(s2."rowid") FROM "StaffInvitation" s2
        WHERE s2."email" = s1."email" AND s2."isConsumed" = 0 AND s2."isRevoked" = 0
      )
  );

-- Create partial unique index on active pending email
CREATE UNIQUE INDEX IF NOT EXISTS "idx_staff_invitation_active_email"
ON "StaffInvitation" ("email")
WHERE "isConsumed" = 0 AND "isRevoked" = 0;
