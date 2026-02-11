# Downloading SoilFER-LIMS

Now let's download the SoilFER-LIMS application onto your server.

---

## Download from GitHub

```bash
cd /opt
sudo git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
```

> **What does this do?**
> - `cd /opt` — navigate to the `/opt` directory (a standard location for optional software on Linux)
> - `git clone ...` — download the entire SoilFER-LIMS codebase from GitHub
> - `cd soilfer-lims` — enter the downloaded folder

You should see something like:

```
Cloning into 'soilfer-lims'...
remote: Enumerating objects: 198, done.
remote: Counting objects: 100% (198/198), done.
Receiving objects: 100% (198/198), 1.23 MiB | 5.00 MiB/s, done.
```

---

## Verify the Download

Let's make sure everything downloaded correctly:

```bash
ls -la
```

You should see files and folders like:

```
docker-compose.yml
docker-compose.global.yml
docker-entrypoint.sh
Dockerfile
README.md
setup.sh
.env.example
client/
server/
deploy/
docs/
```

If you see these files, the download was successful! Continue to [Configuration](./configuration.md).
