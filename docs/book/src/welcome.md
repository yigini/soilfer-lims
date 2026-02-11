# Welcome to the SoilFER-LIMS Guide

<div align="center">

# 🧪 SoilFER-LIMS

### Laboratory Information Management System for Soil Analysis

**Developed under the [FAO SoilFER Programme](https://www.fao.org/soils-portal/soilfer) · Supported by [GLOSOLAN](https://www.fao.org/global-soil-partnership/glosolan)**

---

*An open-source system to help soil laboratories manage their work digitally — from field collection to final report.*

</div>

---

## Who Is This Guide For?

This guide is written for **anyone** who needs to set up or use SoilFER-LIMS, regardless of technical background. You don't need to be a software developer or IT specialist. If you can follow step-by-step instructions and copy-paste commands into a terminal, you can deploy and run your own LIMS.

Whether you are:

- 🔬 A **laboratory manager** who wants to digitize your soil testing workflow
- 🏛️ A **government official** building a national soil information system
- 🎓 A **university researcher** managing samples for a soil fertility study
- 🌍 An **international project coordinator** setting up LIMS for multiple laboratories across countries
- 💻 An **IT specialist** deploying the system for your organization

...this guide will walk you through everything from start to finish.

---

## What Will You Learn?

This guide is organized as a book with clear chapters. You can read it from start to finish, or jump to the section you need:

| Part | What You'll Learn |
|------|------------------|
| **About the Project** | What SoilFER-LIMS is, how it fits into the FAO's global soil programme, and what it can do |
| **Getting Started** | What you need before you begin — servers, domains, and tools |
| **Installation** | How to prepare your server and download the application |
| **Deployment** | Two step-by-step scenarios: brand new server, or adding LIMS to an existing server |
| **Security** | How to secure your site with HTTPS and protect your data |
| **Using LIMS** | Day-to-day usage — receiving samples, entering results, generating reports |
| **Maintenance** | Backups, updates, logs, and password recovery |
| **Troubleshooting** | Solutions to common problems |
| **Reference** | Quick reference card, environment variables, and glossary of terms |

---

## Quick Start (For Experienced Users)

If you're already comfortable with Docker and Linux, here's the fast version:

```bash
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

Open **http://your-server-ip** → login with `admin` / `password` → change password → start working.

For everyone else, please continue to the next chapter! →

---

## Need Help?

If you get stuck at any point:

- 📧 Contact the SoilFER team through the [FAO Global Soil Partnership](https://www.fao.org/global-soil-partnership)
- 🐛 Report bugs on the [GitHub Issues page](https://github.com/yigini/soilfer-lims/issues)
- 📖 Check the [Troubleshooting chapter](./troubleshooting/common-issues.md) for common solutions
