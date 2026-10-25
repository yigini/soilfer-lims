CREATE TABLE "AuthLoginState" (
    "accountKey" TEXT NOT NULL PRIMARY KEY,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" BIGINT NOT NULL DEFAULT 0,
    "lockedUntil" BIGINT NOT NULL DEFAULT 0
);
