# Install SoilFER-LIMS

This walkthrough installs a new instance on a dedicated Linux server using Docker
Compose and the shipped HTTPS proxy. For an existing installation, follow
[UPGRADING.md](UPGRADING.md) and preserve its configuration and named volumes.

## 1. Prepare the server and TLS first

Use a supported Linux distribution, Docker Engine with Compose v2, Git and
Certbot. Follow [Docker's installation instructions](https://docs.docker.com/engine/install/)
and [Certbot's instructions](https://certbot.eff.org/instructions) for your OS.
Allow SSH for administration and public TCP 80/443 for the proxy. Keep port 3000
bound to loopback as shipped.

Plan for **2 GB RAM and at least 20 GB disk** to run a small installation; allow
more for uploaded files, database growth, retained images and backups. Use 4 GB
RAM or a separate build machine for building images. Keep more than 10 GB free
before upgrades. A multi-laboratory installation needs sizing for its workload.

Point your chosen domain at the server. In the examples below, replace
`lims.example.org` with that domain. On a fresh server with port 80 available,
obtain the certificate **before starting the application or NGINX**:

```sh
sudo certbot certonly --standalone -d lims.example.org
```

The certificate and key must exist at:

```text
/etc/letsencrypt/live/lims.example.org/fullchain.pem
/etc/letsencrypt/live/lims.example.org/privkey.pem
```

For a server that already hosts other sites, have its administrator configure the
existing TLS proxy instead of starting a second proxy on the same ports. Use the
same forwarding-header rules shown in [deploy/nginx.conf](../deploy/nginx.conf).

## 2. Download and configure

Clone the repository URL supplied for your distribution into `/opt/lims`:

```sh
git clone <repository-url> /opt/lims
cd /opt/lims
cp .env.example .env
chmod 600 .env
```

Edit `deploy/nginx.conf`: replace every `lims.example.org` occurrence, including
both certificate paths, with your domain. Its HTTP listener only redirects to
HTTPS; its TLS listener forwards HTTP and WebSocket traffic to `lims:3000`.
The Compose override mounts `/etc/letsencrypt` read-only into NGINX.

Edit `.env` before first startup:

```dotenv
DEPLOYMENT_MODE=local
BASE_URL=https://lims.example.org
ALLOWED_ORIGINS=https://lims.example.org
TRUST_PROXY=loopback
```

Choose `local` for one laboratory or `global` for a network of laboratories.
`BASE_URL` is the external HTTPS URL used for report links. `ALLOWED_ORIGINS`
accepts complete HTTPS origins separated by commas, without paths. Leave it empty
only when you intend same-origin browser use exclusively. Add any deliberately
supported additional browser origin explicitly.

Set a long random `JWT_SECRET` using your normal private configuration process,
or leave it blank for the container bootstrap to generate and persist one. Keep
it stable across updates. For the first administrator, either supply a private
`ADMIN_INITIAL_PASSWORD` or use the generated owner-only handoff described in
[HTTP deployment settings](http-deployment-settings.md#initial-administrator-password).
Never place either value in a command shared with other people or in a ticket.

## 3. Set proxy trust to the actual application network

The NGINX container connects from a Docker address, not loopback. Build and
create the containers without starting them, using a stable Compose project name:

```sh
docker compose -p lims -f docker-compose.yml -f docker-compose.nginx.yml build lims
docker compose -p lims -f docker-compose.yml -f docker-compose.nginx.yml create
docker network inspect lims_default --format '{{range .IPAM.Config}}{{println .Subnet}}{{end}}'
```

Add the displayed dedicated project subnet to `TRUST_PROXY`, alongside `loopback`,
in `.env`. Only the application and its trusted proxy should join this network.
Use the actual subnet; do not copy an example, trust every private network, use
`true`, or set an arbitrary hop count. If using a host-managed proxy instead,
configure its actual peer address as seen by the application. Recheck this setting
after any network recreation. See [proxy settings](http-deployment-settings.md).

## 4. Start and verify HTTPS

```sh
docker compose -p lims -f docker-compose.yml -f docker-compose.nginx.yml config --quiet
docker compose -p lims -f docker-compose.yml -f docker-compose.nginx.yml up -d
docker compose -p lims -f docker-compose.yml -f docker-compose.nginx.yml ps
curl --fail https://lims.example.org/api/health
```

Initial database setup can take several minutes. The proxy waits for the LIMS
health check. The public health response should report `status: ok`; it omits
version information by default. Verify HTTP redirects to HTTPS and that the
browser shows a valid certificate. To check the installed version privately:

```sh
docker exec soilfer-lims node -e "fetch('http://127.0.0.1:3000/api/health').then(async r => { const h = await r.json(); if (!r.ok || h.status !== 'ok') process.exit(1); console.log(h.version); }).catch(() => process.exit(1))"
```

Sign in as the initial administrator, complete the required password change, then
configure the laboratory and its staff. Set the installation's contact address in
Branding settings; contact links stay empty until the administrator supplies one.

A new database is initialized with the standard GLOSOLAN analysis catalogue,
including 176 analyses and 467 methodologies with their units and references.
Analysis bundles are configured by each laboratory. Before the first sample
reception, review the available analyses and create any bundles your laboratory
needs in **Admin Panel → Lab Configuration → Analyses & Methods**.

Startup stops if initial catalogue loading fails. Review the first startup error
before completing setup. Starting an existing installation leaves its catalogue
in place.

## 5. Configure certificate renewal

Standalone Certbot needs port 80 briefly during renewal. Save hooks that stop and
start **only the proxy**, using the same paths and project name as installation:

```sh
sudo install -d /etc/letsencrypt/renewal-hooks/pre /etc/letsencrypt/renewal-hooks/post
printf '%s\n' '#!/bin/sh' 'cd /opt/lims && docker compose -p lims -f docker-compose.yml -f docker-compose.nginx.yml stop nginx' | sudo tee /etc/letsencrypt/renewal-hooks/pre/lims-proxy >/dev/null
printf '%s\n' '#!/bin/sh' 'cd /opt/lims && docker compose -p lims -f docker-compose.yml -f docker-compose.nginx.yml start nginx' | sudo tee /etc/letsencrypt/renewal-hooks/post/lims-proxy >/dev/null
sudo chmod 755 /etc/letsencrypt/renewal-hooks/pre/lims-proxy /etc/letsencrypt/renewal-hooks/post/lims-proxy
sudo certbot renew --dry-run
```

Confirm that your Certbot installation's renewal timer is enabled. The rehearsal
briefly interrupts public access while leaving the LIMS container running. See
[Certbot renewal and hooks](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates).

## 6. Make and copy a backup off the server

The shipped Compose file persists the database, uploads and automated backups in
three named volumes. A backup volume on the same server is not an off-host copy.
Use the online SQLite backup tool; copying a live `dev.db` alone can lose WAL data.

```sh
docker exec soilfer-lims node scripts/backup_db.js
docker exec soilfer-lims ls /app/server/backups
```

Choose the new archive name from that listing, then verify and transfer it. Replace
`<archive>` and the destination with your organization's actual backup location:

```sh
docker exec soilfer-lims node scripts/verify_backup.js /app/server/backups/<archive>.db.gz
install -d -m 700 /srv/lims-backups
docker cp soilfer-lims:/app/server/backups/<archive>.db.gz /srv/lims-backups/
sha256sum /srv/lims-backups/<archive>.db.gz
scp /srv/lims-backups/<archive>.db.gz backup-user@backup.example.org:/srv/lims/
```

Verify the checksum on the receiving server and schedule this off-host transfer
with retention appropriate to your laboratory. Back up uploaded assets and private
configuration separately. Rehearse restoration into an isolated instance before
relying on the backup. Never remove named volumes during an ordinary update.
See [backups](book/src/maintenance/backups.md) and [UPGRADING.md](UPGRADING.md).
