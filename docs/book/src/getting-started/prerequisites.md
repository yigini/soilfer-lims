# What You Will Need

Before you begin setting up SoilFER-LIMS, let's make sure you have everything prepared. Don't worry — each item is explained in detail in the following pages.

---

## Checklist

Use this checklist to make sure you have everything ready:

- [ ] **A Linux server** — a computer in a data center that stays on 24/7 and is accessible over the internet
- [ ] **A domain name** — either a new domain (like `soillab.org`) or a subdomain (like `lims.your-institute.org`)
- [ ] **SSH access** — your server's IP address plus a username/password or SSH key to connect
- [ ] **An SSH client** — a program on your computer to connect to your server

---

## What Is a Server?

A **server** is simply a computer that's always running and connected to the internet. Instead of sitting on your desk, it lives in a **data center** — a secure, air-conditioned building full of computers.

You **rent** a server from a hosting provider for a few dollars per month. They handle the hardware, electricity, internet connection, and physical security. You just tell it what software to run.

In cloud computing terms, this is called a **VPS** (Virtual Private Server) — you get your own slice of a physical server, isolated from other users.

> 💡 **Think of it like this:** renting a VPS is like renting an apartment. You pay a monthly fee, you get your own private space, and the building management handles plumbing and electricity. You just bring your furniture (software).

**How much does it cost?** A server powerful enough for SoilFER-LIMS costs between **$4–10 per month** depending on the provider and location.

→ [Learn more about choosing a server](./server.md)

---

## What Is a Domain Name?

A **domain name** is a human-readable address for your server. Instead of asking people to visit `http://46.19.33.37`, you can tell them to go to `https://soillab.org` — much easier to remember and type!

You can either:
- **Buy a new domain** (costs about $10–15/year from registrars like Namecheap or Cloudflare)
- **Use a subdomain** of an existing domain your organization already has (e.g., `lims.your-institute.org`) — this is free, it just requires a small configuration change

→ [Learn more about domain names](./domain.md)

---

## What Is SSH?

**SSH** (Secure Shell) is how you send commands to your server from your own computer. It opens a secure, encrypted connection between your computer and the server, giving you a text-based interface (like a command prompt) where you type instructions.

Don't worry if this sounds unfamiliar — the commands you'll need to type are all provided in this guide, and you just copy-paste them.

**To use SSH you need:**
1. Your server's **IP address** (provided by your hosting company after you create the server)
2. A **username** (usually `root` for new servers)
3. A **password** or **SSH key** (also provided by your hosting company)
4. An **SSH client** — a program on your computer to make the connection

### Which SSH Client to Use

| Your Computer | What to Use | How to Get It |
|--------------|-------------|---------------|
| **Mac** | Terminal | Already installed — search "Terminal" in Spotlight |
| **Linux** | Terminal | Already installed — look in your applications menu |
| **Windows** | PuTTY or Windows Terminal | [Download PuTTY](https://www.putty.org/) (free) or [Windows Terminal](https://apps.microsoft.com/store/detail/windows-terminal/9N0DX20HK701) from the Microsoft Store |

> 💡 **Windows 10/11 users:** You can also use the built-in Command Prompt or PowerShell — they now support SSH. Open Command Prompt and type `ssh root@YOUR_IP`.

→ [Learn how to connect to your server](./connecting.md)

---

## What Is Docker?

**Docker** is a tool that packages an application and everything it needs (programming language, libraries, database, web server) into a single, self-contained unit called a "container."

Without Docker, you'd have to manually install Node.js, set up the database, configure a web server, and make sure all the versions are compatible. With Docker, all of this is handled automatically with a single command.

> 💡 **Think of it like this:** Docker is like a shipping container. Instead of packing your belongings loose on a ship and hoping nothing breaks, you put everything in a standard-sized container. It arrives intact, and it works the same regardless of which ship carried it.

**You don't need to install Docker on your own computer.** You'll install it on the server (which we'll walk you through step by step).

**External help:**
- [What is Docker? (video, 4 min)](https://www.youtube.com/watch?v=Gjnup-PuquQ)
- [Docker documentation](https://docs.docker.com/)
- [Docker for beginners (guide)](https://docker-curriculum.com/)
