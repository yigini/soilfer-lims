# Preparing Your Server

Before installing SoilFER-LIMS, we need to install two pieces of software on your server: **Docker** (which runs the application) and **Git** (which downloads the code).

---

## Step 1: Update Your Server

Always start by updating your server. This ensures you have the latest security patches.

```bash
sudo apt update && sudo apt upgrade -y
```

> **What does this do?**
> - `sudo` = run as administrator
> - `apt update` = check what software updates are available
> - `apt upgrade -y` = install all available updates (`-y` means "yes to all" so you don't have to confirm each one)

This may take a few minutes. You might see a lot of text scrolling — that's normal.

---

## Step 2: Install Docker

Docker is the tool that will run SoilFER-LIMS. Install it with this one-liner:

```bash
curl -fsSL https://get.docker.com | sh
```

> **What does this do?** It downloads the official Docker installation script from docker.com and runs it. The script automatically detects your OS version and installs the correct Docker package.

Wait for it to finish (1-2 minutes). Then verify the installation:

```bash
docker --version
```

You should see something like:
```
Docker version 27.3.1, build ce12230
```

Also check Docker Compose:

```bash
docker compose version
```

You should see:
```
Docker Compose version v2.29.7
```

> ⚠️ **If `docker compose version` fails**, install it separately:
> ```bash
> sudo apt install -y docker-compose-plugin
> ```

> 📖 **More about Docker installation:** [Official Docker install guide for Ubuntu](https://docs.docker.com/engine/install/ubuntu/)

---

## Step 3: Install Git

Git is the tool used to download SoilFER-LIMS from GitHub (and to receive future updates).

```bash
sudo apt install -y git
```

Verify:

```bash
git --version
```

You should see something like `git version 2.43.0`.

---

## You're Ready!

Your server now has everything it needs. Continue to [Downloading SoilFER-LIMS](./download.md).
