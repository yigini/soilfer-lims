# Configuration

Before starting SoilFER-LIMS, you need to create a configuration file that tells the application how to behave.

---

## Create the Configuration File

SoilFER-LIMS reads its settings from a file called `.env` (short for "environment"). A template is provided:

```bash
cp .env.example .env
```

> **What does this do?** It copies the template file `.env.example` to a new file called `.env`. The application reads from `.env`, so the template is just a starting point.

---

## Edit the Configuration

Open the file in a text editor:

```bash
nano .env
```

You'll see:

```
PORT=3000
JWT_SECRET=
NODE_ENV=production
DEPLOYMENT_MODE=local
```

Here's what each setting means:

### PORT

```
PORT=3000
```

The internal port the application runs on. **Leave this as 3000** — users won't see this port number because NGINX handles the public-facing connection on port 80/443.

### JWT_SECRET

```
JWT_SECRET=
```

This is a security token used to encrypt login sessions. **You can leave it blank** — the application will automatically generate a secure random secret on first boot.

> 💡 If you want to set your own, generate a random secret with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```
> Copy the long string of letters and numbers and paste it after `JWT_SECRET=`.

### NODE_ENV

```
NODE_ENV=production
```

Tells the application to run in production mode. **Leave this as `production`.**

### DEPLOYMENT_MODE

```
DEPLOYMENT_MODE=local
```

This is the most important choice:

| Value | When to Use |
|-------|-------------|
| `local` | You have **one laboratory**. This is the simplest setup and perfect for most labs. |
| `global` | You manage **multiple laboratories** (e.g., a national program with regional labs). This enables multi-lab management with data isolation. |

> 💡 **Not sure which to choose?** Start with `local`. You can change to `global` later if your needs grow.

---

## Save and Exit

Press **Ctrl+O** (that's the letter O, not zero), then **Enter** to save, then **Ctrl+X** to exit the editor.

---

## Next Steps

Continue to [Connecting Your Domain (DNS)](./dns.md) if you have a domain ready, or go directly to [Scenario A: Fresh Server](../deployment/scenario-a.md) if you want to start with just the IP address and add a domain later.
