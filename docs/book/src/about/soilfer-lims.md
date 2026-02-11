# About SoilFER-LIMS

## What Is a LIMS?

A **LIMS** (Laboratory Information Management System) is software that helps laboratories manage their daily operations. Think of it as the digital backbone of a lab — instead of using paper logbooks, spreadsheets, or separate tools for different tasks, everything lives in one organized system.

Before LIMS, a typical soil lab might track samples in a paper notebook, record results in Excel, store reports in Word documents, and communicate assignments by walking to someone's desk. This works in a small lab with a few samples per week, but it becomes chaotic when you're processing hundreds or thousands of samples across multiple projects.

A LIMS brings order to this process by providing:

- **One place for everything** — samples, results, reports, equipment records, and user accounts
- **Traceability** — know exactly who did what, when, and to which sample
- **Automation** — automatic sample numbering, status tracking, and notifications
- **Quality control** — built-in review workflows so results are checked before being finalized
- **Reporting** — generate standardized reports with a few clicks

## What Makes SoilFER-LIMS Special?

SoilFER-LIMS is not a generic laboratory system. It was designed specifically for **soil analysis laboratories**, with features that only make sense in the soil science context:

### 🌱 Built for Soil Science
- Pre-configured for common soil analyses (pH, organic carbon, nitrogen, phosphorus, potassium, texture, CEC, and more)
- Standard soil depth recording and horizon classification
- Integration with soil spectroscopy (MIR/NIR)
- GPS coordinate tracking and interactive 3D maps of sampling sites

### 🌍 Built for Global Deployment
- Designed for laboratories in developing countries where resources may be limited
- Runs on very modest hardware (a $5/month server is sufficient)
- Uses SQLite — no need to install or manage a separate database server
- Works offline once loaded (the database is a single file, not a remote service)
- Available in multiple languages (English, French, Spanish, Portuguese)

### 📱 Built for Field-to-Lab Workflows
- Direct integration with [KoboToolbox](https://www.kobotoolbox.org/) — the most popular mobile data collection tool used by international development organizations
- Field teams submit samples via their phones; the data automatically appears in the LIMS
- Photos, GPS coordinates, and field observations sync seamlessly

### 🏛️ Built for National Programmes
- **Multi-laboratory mode** for managing entire networks of soil labs under one system
- Full data isolation between laboratories (Lab A cannot see Lab B's data)
- Role-based access control with five distinct user roles
- Designed to feed into National Soil Information Systems (NSIS)

### 🔓 Open Source & Free
- SoilFER-LIMS is released under the [MIT License](https://opensource.org/licenses/MIT) — you can use, modify, and distribute it freely
- No licensing fees, no subscriptions, no vendor lock-in
- The source code is publicly available on [GitHub](https://github.com/yigini/soilfer-lims)
- You can host it on your own server — your data stays under your control

---

## Two Deployment Modes

SoilFER-LIMS can run in two modes. You choose which mode during setup, and it can be changed later if your needs grow.

### Local Mode — Single Laboratory

Best for: One soil laboratory that wants to go digital.

In this mode, the system is configured for a single lab. There's one administrator (the Lab Manager) who manages all users, projects, and samples. Everyone using the system belongs to the same lab.

**Example use case:** A university soil testing lab that processes 500 samples per year for research projects and local farmers.

### Global Mode — Laboratory Network

Best for: National soil programmes, GLOSOLAN regional networks, or any organization coordinating multiple laboratories.

In this mode, a Super Administrator creates and manages multiple laboratories within the same system. Each lab has its own Lab Manager, technicians, and data — completely isolated from other labs. The Super Admin can see aggregate statistics but individual lab data stays within each lab.

**Example use case:** A national agricultural ministry that coordinates 5 regional soil labs across the country, each processing samples for local projects. The ministry can monitor overall progress while each lab operates independently.

| Feature | Local Mode | Global Mode |
|---------|-----------|-------------|
| Number of labs | 1 | Unlimited |
| Default admin role | Lab Manager | Super Admin |
| Data isolation | Single data pool | Fully separated per lab |
| Best for | Individual laboratories | National programmes, lab networks |

---

## How Does It Work Technically?

> **You don't need to understand this section to use the system.** It's here for IT teams and curious readers.

SoilFER-LIMS is a modern **web application** built with:

| Component | Technology | What It Does |
|-----------|-----------|-------------|
| **Frontend** | React with Vite | The website interface your team sees in the browser |
| **Backend** | Node.js with Express | The API server that processes requests and business logic |
| **Database** | SQLite with Prisma ORM | Stores all your data in a single file — no database server needed |
| **Maps** | CesiumJS | Interactive 3D globe for visualizing sampling locations |
| **Translations** | i18next | Multi-language support |
| **Authentication** | JWT tokens + bcrypt | Secure login and session management |
| **Containerization** | Docker | Packages everything so deployment is a single command |

The entire application runs in a Docker container, which means you don't need to install Node.js, configure databases, or manage web servers. Docker handles all of that for you.

---

## External Resources

- **FAO SoilFER Programme:** [fao.org/soils-portal/soilfer](https://www.fao.org/soils-portal/soilfer)
- **GLOSOLAN:** [fao.org/global-soil-partnership/glosolan](https://www.fao.org/global-soil-partnership/glosolan)
- **Source Code (GitHub):** [github.com/yigini/soilfer-lims](https://github.com/yigini/soilfer-lims)
- **Report Issues:** [github.com/yigini/soilfer-lims/issues](https://github.com/yigini/soilfer-lims/issues)
