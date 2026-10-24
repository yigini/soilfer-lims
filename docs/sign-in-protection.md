Sign-in protection uses the same installation policy for every account, including unknown usernames. The existing IP limiter remains active. Account state is stored separately in `AuthLoginState`, keyed by a SHA-256 digest of the exact username accepted by the existing login lookup. It survives application restarts and is shared by processes using the same SQLite database.

After five failures in fifteen minutes, the first delay is one second. Each subsequent failed attempt after the delay expires doubles the delay, up to fifteen minutes. Attempts during the delay return 429 and `Retry-After` without extending it. A successful login resets the account state; a new window resets expired failures. Unknown accounts undergo a cost-10 dummy bcrypt comparison and use the same response body and backoff rules. Failure and lockout audit events retain at most 256 characters of the typed username, 128 characters of the effective client IP, and a reason code. Passwords and password hashes are excluded.

Installation owners can set these validated keys in the selected deployment profile's `policy.json` overrides:

| Key | Default | Allowed range |
| --- | --- | --- |
| `auth.loginFailureThreshold` | 5 | 1–100 |
| `auth.loginWindowMinutes` | 15 | 1–1440 |
| `auth.loginMaxDelayMinutes` | 15 | 1–1440 |
| `auth.passwordMinLength` | 12 | 12–64 |

These installation settings cannot be changed through a laboratory policy endpoint. Configure the real trusted proxy peer as described in [HTTP deployment settings](http-deployment-settings.md), so the existing IP limiter sees client addresses.

The password rule applies to new accounts, bootstrap credentials, administrative replacement, invitation activation, self-service change and recovery. Existing credentials continue to work until changed. New passwords may contain at most 72 UTF-8 bytes to prevent bcrypt truncation. The forms receive the configured minimum through their existing session or grant metadata. A forced-change session can use only the exact self-identification, password-change and logout paths; other user APIs, SIS user tokens and WebSockets use the shared principal check.

The additive schema installer is `server/scripts/install_signin_protection.js`. It requires an explicit existing `--db` path, supports `--dry-run` and `--apply`, pins the canonical migration bytes, refuses partial or unmarked populated state, and records an installation receipt while preserving existing rows. Normal container startup runs it; direct Node startup refuses missing readiness. The image retains its canonical DDL outside the mounted Prisma directory. Include it in the established stopped-backup, integrity and source-guard release procedure. No migration, credential change or production operation is performed by this document.
