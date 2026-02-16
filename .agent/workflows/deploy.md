---
description: How to deploy changes to DEV and PRODUCTION servers
---

# Deployment Workflow

## DEV (localhost:3000)

### Code-only changes
// turbo
1. Kill any existing server: `for /f "tokens=5" %a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %a /F`
// turbo
2. Start the server: `cd /d c:\Users\yigin\Documents\LIMSI\soilfer-lims\server && node index.js`

### Schema changes
// turbo
1. Regenerate client: `cd /d c:\Users\yigin\Documents\LIMSI\soilfer-lims\server && npx prisma generate`
// turbo
2. Push schema to DB: `cd /d c:\Users\yigin\Documents\LIMSI\soilfer-lims\server && npx prisma db push`
3. Restart the server (follow "Code-only changes" above)

---

## PRODUCTION (lims.yigini.net)

> **Architecture notes:**
> - Docker compose overrides entrypoint to `node /app/server/index.js` directly
> - Volume mount `/opt/lims/data/prisma` overlays `/app/server/prisma` in the container
> - So `schema.prisma` must be uploaded to BOTH `/opt/lims/server/prisma/` (Docker build context) AND `/opt/lims/data/prisma/` (runtime volume)
> - `better-sqlite3` native addon is compiled during Docker build via `npm rebuild`

### Client-only changes (UI/CSS/translations)
// turbo
1. Build locally: `cd /d c:\Users\yigin\Documents\LIMSI\soilfer-lims\client && npm.cmd run build 2>&1`
2. Clean host dist: `ssh root@lims.yigini.net "rm -rf /opt/lims/client/dist/*"`
3. Upload index.html: `scp "c:\Users\yigin\Documents\LIMSI\soilfer-lims\client\dist\index.html" root@lims.yigini.net:/opt/lims/client/dist/index.html`
4. Upload assets: `scp -r "c:\Users\yigin\Documents\LIMSI\soilfer-lims\client\dist\assets" root@lims.yigini.net:/opt/lims/client/dist/assets`
5. Clean-replace container dist and restart: `ssh root@lims.yigini.net "docker exec soilfer-lims rm -rf /app/client/dist && docker cp /opt/lims/client/dist soilfer-lims:/app/client/dist && docker restart soilfer-lims 2>&1"`

> **IMPORTANT:** Always `rm -rf` the container's dist before `docker cp`. The `docker cp` command is ADDITIVE — it copies files in but never deletes old ones, causing stale asset accumulation.

// turbo
4. Verify health: `ssh root@lims.yigini.net "sleep 10 ; docker ps --format 'table {{.Names}}\t{{.Status}}' ; wget -qO- http://localhost:3000/api/health"`

### Code-only changes (no schema change)
1. Upload changed files: `scp server/prisma.js server/<other-files> root@lims.yigini.net:/opt/lims/server/`
2. Rebuild and restart: `ssh root@lims.yigini.net "cd /opt/lims ; docker compose build --no-cache 2>&1 | tail -10 ; docker compose up -d 2>&1"`
// turbo
3. Verify health: `ssh root@lims.yigini.net "sleep 10 ; docker ps --format 'table {{.Names}}\t{{.Status}}' ; wget -qO- http://localhost:3000/api/health"`

### Schema changes
1. Upload schema to Docker build context: `scp server/prisma/schema.prisma root@lims.yigini.net:/opt/lims/server/prisma/schema.prisma`
2. Upload schema to runtime volume: `scp server/prisma/schema.prisma root@lims.yigini.net:/opt/lims/data/prisma/schema.prisma`
3. Rebuild and restart: `ssh root@lims.yigini.net "cd /opt/lims ; docker compose build --no-cache 2>&1 | tail -10 ; docker compose up -d 2>&1"`
4. Push schema to production DB: `ssh root@lims.yigini.net "docker exec soilfer-lims npx prisma db push"`
// turbo
5. Verify health: `ssh root@lims.yigini.net "sleep 10 ; docker ps --format 'table {{.Names}}\t{{.Status}}' ; wget -qO- http://localhost:3000/api/health"`

### Full redeployment (all files)
1. Upload all server files:
   ```
   scp server/prisma.js server/prisma.config.ts server/package.json server/package-lock.json root@lims.yigini.net:/opt/lims/server/
   scp server/prisma/schema.prisma root@lims.yigini.net:/opt/lims/server/prisma/schema.prisma
   scp server/prisma/schema.prisma root@lims.yigini.net:/opt/lims/data/prisma/schema.prisma
   ```
2. Rebuild with no cache: `ssh root@lims.yigini.net "cd /opt/lims ; docker compose down ; docker rmi lims-lims 2>/dev/null ; docker compose build --no-cache 2>&1 | tail -10 ; docker compose up -d 2>&1"`
// turbo
3. Verify health: `ssh root@lims.yigini.net "sleep 12 ; docker ps --format 'table {{.Names}}\t{{.Status}}' ; wget -qO- http://localhost:3000/api/health"`

### Troubleshooting
// turbo
- Check logs: `ssh root@lims.yigini.net "docker logs --tail 30 soilfer-lims 2>&1"`
// turbo
- Check container status: `ssh root@lims.yigini.net "docker ps -a --format 'table {{.Names}}\t{{.Status}}'"`
- Force restart: `ssh root@lims.yigini.net "cd /opt/lims ; docker compose restart"`
