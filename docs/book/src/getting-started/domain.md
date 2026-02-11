# Getting a Domain Name

A **domain name** is the address people type into their browser to access your LIMS. Instead of `http://46.19.33.37:3000`, your users go to `https://soillab.org` — much more professional and memorable.

---

## Option 1: Buy a New Domain

If your organization doesn't have a domain yet, or you want a dedicated domain for the LIMS, you can buy one from a **domain registrar**.

### Recommended Registrars

| Registrar | Price for .org | Notes |
|-----------|---------------|-------|
| [Namecheap](https://www.namecheap.com) | ~$10/year | Easy to use, affordable |
| [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) | ~$10/year | No markup — you pay wholesale price. Also provides free CDN and DDoS protection. |
| [GoDaddy](https://www.godaddy.com) | ~$12/year | Well-known, widely available |
| [Gandi](https://www.gandi.net) | ~$12/year | Popular in francophone countries |
| [Google Domains](https://domains.google/) | ~$12/year | Clean interface, integrates with Google services |

### How to Buy a Domain

1. Go to any registrar's website
2. Search for your desired domain name (e.g., `soillab-kenya.org`)
3. If it's available, add it to your cart
4. Complete the purchase (you'll need an email address and payment method)
5. You now own the domain for one year (with the option to auto-renew)

> 💡 **Choosing a domain name:** Keep it short, memorable, and related to your lab. Examples:
> - `soillab-ghana.org`
> - `soilfer-lab.org`
> - `national-soil-lab.com`

---

## Option 2: Use a Subdomain of an Existing Domain

If your organization already has a domain (like `ministry-of-agriculture.gov.gh` or `your-university.edu`), you can create a **subdomain** for the LIMS. A subdomain is a prefix added to your existing domain:

- `lims.ministry-of-agriculture.gov.gh`
- `soillab.your-university.edu`

This is **free** — you just need to add a DNS record (we'll cover that in the [DNS chapter](../installation/dns.md)). Ask your IT department to help with this if you don't have access to the domain's DNS settings yourself.

---

## Do I Really Need a Domain?

**Technically, no.** You can access SoilFER-LIMS using your server's IP address (like `http://46.19.33.37`). However, a domain name is **strongly recommended** because:

1. **Easier to remember** — `soillab.org` vs `46.19.33.37`
2. **Required for HTTPS** — SSL certificates (the green lock in browsers) are issued for domain names, not IP addresses
3. **Professional appearance** — a proper domain looks more trustworthy to users and stakeholders
4. **Won't change** — if you switch servers, you update the DNS record and the domain continues to work. With an IP address, you'd need to tell everyone the new address.

---

## What If I'm Not Ready to Buy a Domain Yet?

That's perfectly fine! You can set up SoilFER-LIMS using your server's IP address first, and add a domain later. When you eventually add a domain, just follow the [DNS setup instructions](../installation/dns.md) and your LIMS will be accessible at both the IP address and the domain name.

**External help:**
- [What is a domain name? (Cloudflare explanation)](https://www.cloudflare.com/learning/dns/glossary/what-is-a-domain-name/)
- [What is DNS? (AWS explanation)](https://aws.amazon.com/route53/what-is-dns/)
