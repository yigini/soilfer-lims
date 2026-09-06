# Firewall & Security Best Practices

Keeping your LIMS secure doesn't require advanced IT skills, but there are a few important steps you should take to protect your data and your users.

---

## Set Up a Firewall

A **firewall** controls which network ports are open on your server. You only want to allow the ports that are actually needed.

```bash
# Allow SSH connections (so you can still connect to your server!)
sudo ufw allow ssh

# Allow HTTP and HTTPS (web traffic)
sudo ufw allow 80
sudo ufw allow 443

# Enable the firewall
sudo ufw enable

# Check the status
sudo ufw status
```

You should see:

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

> ⚠️ **Always allow SSH (port 22) first!** If you enable the firewall without allowing SSH, you will lock yourself out of your server.

> 📖 [UFW Essentials (DigitalOcean)](https://www.digitalocean.com/community/tutorials/ufw-essentials-common-firewall-rules-and-commands)

---

## Security Checklist

Here are the most important security practices for your LIMS deployment:

- [ ] **Use HTTPS** — set up SSL certificates (see [previous chapter](./ssl.md))
- [ ] **Change the initial administrator password** — do this immediately upon first login
- [ ] **Enable the firewall** — only open ports 22, 80, and 443
- [ ] **Use strong passwords** — at least 12 characters, mix of letters, numbers, symbols
- [ ] **Create individual user accounts** — don't share the admin account
- [ ] **Set up automatic backups** — see [Backing Up Your Data](../maintenance/backups.md)
- [ ] **Keep the server updated** — run `sudo apt update && sudo apt upgrade -y` monthly
- [ ] **Keep SoilFER-LIMS updated** — pull new versions regularly (see [Updates](../maintenance/updates.md))

---

## Regular Maintenance

Set a monthly calendar reminder to:

1. Connect to your server via SSH
2. Run `sudo apt update && sudo apt upgrade -y`
3. Check `docker ps` to make sure containers are healthy
4. Verify backups are being created (check `/opt/backups/`)

This takes 5 minutes and keeps your server secure and healthy.

> 📖 **Server security guides:**
> - [Initial Server Setup with Ubuntu (DigitalOcean)](https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu-22-04)
> - [Securing Ubuntu Server (Ubuntu docs)](https://ubuntu.com/server/docs/security-introduction)
