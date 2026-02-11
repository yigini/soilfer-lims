# Getting a Server

This page walks you through choosing and creating a server (VPS) to host SoilFER-LIMS.

---

## Recommended Providers

Here are some reliable, affordable VPS providers. Any of them will work well for SoilFER-LIMS. Choose the one that feels most comfortable to you, or the one with the closest server location to your users.

| Provider | Starting Price | Server Locations | Notes |
|----------|---------------|-----------------|-------|
| [Hetzner](https://www.hetzner.com/cloud) | ~€4/month | Germany, Finland, USA, Singapore | Best price/performance. Popular in Europe and Africa. |
| [DigitalOcean](https://www.digitalocean.com) | $6/month | US, Europe, Singapore, India | Very beginner-friendly with excellent tutorials. |
| [OVH](https://www.ovhcloud.com) | ~€4/month | France, Germany, Canada, Singapore, Australia | Popular in francophone Africa. Good French-language support. |
| [Linode (Akamai)](https://www.linode.com) | $5/month | US, Europe, Asia, Australia | Reliable, good documentation. |
| [AWS Lightsail](https://aws.amazon.com/lightsail/) | $5/month | Worldwide | Amazon's simplified VPS. Good if your organization already uses AWS. |
| [Vultr](https://www.vultr.com) | $5/month | 32 locations worldwide | Many African server locations (Johannesburg). |

> 💡 **Tip for African labs:** Vultr has a server location in Johannesburg, South Africa. Hetzner also has excellent pricing and reliability. OVH is popular in French-speaking countries and has servers in many locations.

---

## Minimum Server Specifications

SoilFER-LIMS is lightweight. It doesn't need a powerful server.

| Specification | Minimum | Recommended | Explanation |
|--------------|---------|-------------|-------------|
| **CPU** | 1 core | 2 cores | How many tasks the server can handle simultaneously |
| **RAM** | 1 GB | 2 GB | Short-term memory for running the application |
| **Disk** | 10 GB | 20 GB+ | Storage for the application, database, and uploaded files |
| **Operating System** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS | The server's base software. Choose "LTS" (Long Term Support) for stability. |

> **How much data does LIMS store?** A database with 10,000 samples and their results uses roughly 50-100 MB. Spectral data files are larger — if you upload thousands of spectra, plan for 5-10 GB of storage. For most laboratories, the minimum 10 GB disk is more than sufficient for the first few years.

---

## Step-by-Step: Creating a Server on Hetzner

This walkthrough uses Hetzner as an example, but the process is very similar on all providers.

### 1. Create an Account

Go to [hetzner.com/cloud](https://www.hetzner.com/cloud) and click **"Register"**. You'll need an email address and a payment method (credit/debit card or PayPal).

### 2. Create a Project

After logging in, Hetzner shows you a dashboard. Click **"New project"** and give it a name like "SoilFER-LIMS."

### 3. Add a Server

Click **"Add Server"** and configure:

**Location:** Choose a location close to your users. For example:
- Falkenstein or Nuremberg (Germany) for European/African labs
- Ashburn (USA) for American labs
- Singapore for Asian labs

**Image (Operating System):** Choose **Ubuntu 22.04** or **Ubuntu 24.04**.

> ⚠️ Always choose Ubuntu LTS. Do not choose other operating systems unless you have a specific reason and know what you're doing.

**Type (Size):** Select **CX22** (2 CPU, 4 GB RAM) — this costs about €4/month and is more than enough. You can always upgrade later if needed.

**SSH Key (Optional but Recommended):** If you know how to create SSH keys, add your public key here. Otherwise, leave this blank and Hetzner will email you a root password.

> 💡 **What is an SSH key?** It's a more secure way to log in to your server without typing a password. If you're not sure, just use a password for now — you can add SSH keys later.
>
> If you want to learn how: [How to create SSH keys (DigitalOcean guide)](https://www.digitalocean.com/community/tutorials/how-to-set-up-ssh-keys-on-ubuntu-22-04)

**Name:** Give your server a descriptive name like `soilfer-lims` or `soillab-server`.

### 4. Create

Click **"Create & Buy now"**. Your server will be ready in about 30 seconds.

### 5. Note Your IP Address

After creation, you'll see your server in the dashboard. The most important piece of information is the **IP address** — something like `46.19.33.37`. Write this down! You'll need it to:
- Connect to the server via SSH
- Point your domain to the server

If you chose password authentication, Hetzner will email you the root password.

---

## Step-by-Step: Creating a Server on DigitalOcean

### 1-2. Sign Up

Go to [digitalocean.com](https://www.digitalocean.com), create an account, and verify your payment method.

### 3. Create a Droplet

Click **"Create → Droplets"** (DigitalOcean calls their servers "Droplets").

- **Region:** Choose the closest to your users
- **Image:** Ubuntu 22.04 LTS
- **Size:** Regular, $6/month (1 CPU, 1 GB RAM)
- **Authentication:** Password or SSH key
- **Hostname:** `soilfer-lims`

### 4. Create

Click **"Create Droplet"**. Note the IP address from the dashboard.

> 📖 DigitalOcean has excellent beginner tutorials: [Initial Server Setup with Ubuntu (DigitalOcean)](https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu-22-04)

---

## After Creating Your Server

Regardless of which provider you used, you now have:

1. ✅ A server running Ubuntu Linux
2. ✅ An IP address (e.g., `46.19.33.37`)
3. ✅ A root password (emailed to you) or SSH key access

You're ready to connect! Continue to [Connecting to Your Server](./connecting.md).
