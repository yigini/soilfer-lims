-- #202: one optional bench PIN per user for shared-terminal re-entry.
-- Additive only; the hash is a credential, never analytical evidence.
CREATE TABLE "UserBenchCredential" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "pinHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserBenchCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
