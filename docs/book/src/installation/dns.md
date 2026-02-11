# Connecting Your Domain (DNS)

**DNS** (Domain Name System) is the internet's address book. It translates human-readable names like `soillab.org` into the IP addresses that computers use (like `46.19.33.37`).

To make your domain point to your server, you need to add a **DNS record** — essentially telling the internet "when someone types `soillab.org`, send them to the server at `46.19.33.37`."

---

## How to Add a DNS Record

Log in to the website where you manage your domain. This is the domain registrar (Namecheap, Cloudflare, GoDaddy, etc.) or your organization's DNS management panel.

Look for a section called **"DNS"**, **"DNS Records"**, **"DNS Management"**, or **"Zone Editor"**.

### For a Fresh Domain (e.g., `soillab.org`)

Add two records:

| Type | Name / Host | Value / Points to | TTL |
|------|-------------|------------------|-----|
| **A** | `@` | `YOUR_SERVER_IP` | Auto or 3600 |
| **A** | `www` | `YOUR_SERVER_IP` | Auto or 3600 |

> **Explanation:**
> - **Type "A"** means "this domain points to this IP address"
> - **Name `@`** means the root domain itself (`soillab.org`)
> - **Name `www`** means the `www` subdomain (`www.soillab.org`)
> - **Value** is your server's IP address
> - **TTL** is how long DNS servers cache this record (Auto or 3600 seconds is fine)

### For a Subdomain (e.g., `lims.your-institute.org`)

Add one record:

| Type | Name / Host | Value / Points to | TTL |
|------|-------------|------------------|-----|
| **A** | `lims` | `YOUR_SERVER_IP` | Auto or 3600 |

> If you don't have access to your organization's DNS settings, ask your IT department. Tell them: *"Please add an A record for `lims` pointing to `YOUR_SERVER_IP`."*

---

## Verify DNS Is Working

After adding the record, wait a few minutes (it can take up to 1 hour for DNS changes to spread across the internet — this is called "propagation").

### Check Online

Visit [whatsmydns.net](https://www.whatsmydns.net/), type your domain, and select **A** record. If you see your server's IP address appearing at most locations, DNS is working.

### Check from Your Terminal

```bash
ping soillab.org
```

If it shows your server's IP address in the response, DNS is working:

```
PING soillab.org (46.19.33.37): 56 data bytes
```

---

## Don't Wait — Keep Going

While DNS propagates, you can continue with the deployment steps. You can test using your server's IP address until the domain starts working.

> 📖 **Want to understand DNS better?**
> - [What is DNS? (Cloudflare — simple explanation)](https://www.cloudflare.com/learning/dns/what-is-dns/)
> - [Understanding DNS records (DigitalOcean)](https://www.digitalocean.com/community/tutorials/an-introduction-to-dns-terminology-components-and-concepts)
