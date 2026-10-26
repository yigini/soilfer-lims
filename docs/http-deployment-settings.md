# HTTP deployment settings

Set these values in the install's private `.env` or container environment before
starting the server. Docker Compose passes them to the application. Restart after
changing them; an existing install's settings are not rewritten by `setup.sh`.

| Setting | Default | Behavior |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | empty | Production permits same-origin browser use. To permit another browser origin, supply a comma-separated list of complete HTTPS origins, such as `https://preview.example.org`. Paths, user information, query strings, fragments and HTTP entries cause startup refusal. |
| `TRUST_PROXY` | `loopback` | Express trusts forwarding headers only from loopback proxies. Use a comma-separated list of the actual proxy IP addresses or dedicated proxy subnets. `false` disables proxy trust. |
| `HEALTH_SHOW_VERSION` | `false` | `/api/health` and `/api/version` return only `{"status":"ok"}` to non-loopback callers. Exactly `true` makes version and uptime public. |
| `API_RATE_LIMIT_USER_MAX` | `3000` | Maximum `/api` requests per 15 minutes for each user id in a signature-verified, unexpired JWT. Different users behind the same IP have separate budgets; a user's sessions share one budget. |
| `API_RATE_LIMIT_ANON_MAX` | `300` | Maximum `/api` requests per 15 minutes for each client IP without a valid JWT, including missing, forged and expired tokens. IPv6 addresses use the limiter's default /56 grouping. |

Both API budgets must be positive integers; invalid values refuse startup. They
apply before route authentication and do not grant access or replace active-session,
permission or laboratory checks. The separate login/register limiter and per-account
sign-in backoff still apply unchanged. Configure proxy trust from the observed
proxy peer so anonymous clients are identified correctly. The request counters are
in memory in each server process and reset on restart.

Non-production retains the existing wildcard development CORS behavior, including
the Vite development origin. Production grants no CORS response header to an
unlisted origin, an HTTP origin, or a request without Origin. Ordinary same-origin
requests and command-line clients continue to work without a CORS grant. CORS is
a browser boundary; authentication and laboratory scope still apply to API calls.

The main Compose file publishes the API on `127.0.0.1:${PORT:-3000}`, rather than all
host interfaces. Serve remote users through the reverse proxy and HTTPS.

## Configure the shipped proxy

The shipped NGINX configuration sets Host and X-Forwarded-Proto and appends the
actual peer to X-Forwarded-For. Its Docker address is not loopback. Before allowing
public traffic, obtain that address on the application network:

```sh
docker inspect soilfer-nginx --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'
```

Add only that proxy address to `TRUST_PROXY` alongside `loopback`, then recreate
the application container with the updated environment. If proxy addresses change,
use a dedicated proxy network's subnet and restrict who can join it. Recheck trust
after a network recreation. A host proxy connecting through the Docker bridge
also needs its actual bridge peer address in this list. Do not substitute all
private networks, `true`, or a fixed hop count for a verified proxy boundary.

Forwarded client addresses affect rate limiting and health metadata. A public
client cannot become loopback merely by prepending a spoofed X-Forwarded-For:
Express stops at the first untrusted peer when walking the chain from the server.

Extra preview origins belong in the deployment environment, not in source.
For an existing installation, preserve its configuration and add only the settings
required for its approved proxy and preview origin.

## Host-side deployment health check

An ordinary host-to-published-port request can reach Node through a non-loopback
Docker bridge address and therefore receive only `{"status":"ok"}`. Keep public
metadata disabled. Run the version check from the host through the container's
own loopback interface instead:

```sh
docker exec soilfer-lims node -e "fetch('http://127.0.0.1:3000/api/health').then(async r => { const h = await r.json(); if (!r.ok || h.status !== 'ok' || typeof h.version !== 'string') process.exit(1); console.log(JSON.stringify(h)); }).catch(() => process.exit(1))"
```

Check the returned version against the approved release. The public health check
still checks HTTP success and `status: ok`; it no longer requires version fields.
Both health endpoints use `Cache-Control: no-store`.

## Initial administrator password

Seeding an empty installation still creates one administrator who must change the
password at first sign-in. A supplied `ADMIN_INITIAL_PASSWORD` is used without
echoing it. Otherwise, bootstrap creates a random password and writes it to a new
file in `.initial-admin-credentials/` beside the database. The directory is mode
0700 and files are mode 0600 on Linux. The log reports only the file's path. That
directory is excluded from Git and Docker build contexts. Existing users are not
changed by seeding, and existing handoff files are never overwritten.

The local operator should read the reported file through a private terminal,
complete the forced password change, then remove that handoff file. Keep it out of
shared terminals, logs and support tickets. On Windows, restrict the directory ACL
to the installing account; POSIX mode bits alone do not enforce Windows ACLs.
The provisioning CLI uses the same private handoff for a generated password.

The unsaved Kobo connection test accepts only public HTTPS targets, resolves and
pins public DNS answers, and sends no credentials through redirects or proxies.
It does not contact private or loopback services. Existing saved synchronization
and attachment authorization paths retain their separate rules.
