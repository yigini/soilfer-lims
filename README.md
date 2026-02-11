# 🧪 SoilFER-LIMS

**Laboratory Information Management System for Soil Analysis**

A full-featured, open-source LIMS designed for soil fertility laboratories. Track samples from field collection through analysis to final reporting — with built-in field data sync, spectral analysis, multi-lab support, and interactive 3D mapping.

---

## 🚀 Two Deployment Modes

| | **Local** | **Global** |
|---|---|---|
| **Purpose** | Single laboratory | Multi-laboratory network |
| **Users** | Lab Manager + Technicians | Super Admin + multiple Lab Managers |
| **Data isolation** | All data in one lab context | Full RBAC isolation per laboratory |
| **Default account** | `admin` (LAB_MANAGER) | `admin` (SUPER_ADMIN) |
| **Best for** | Individual soil labs | National soil programs, research networks |

---

## ⚡ Quick Start (Docker)

```bash
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
cp .env.example .env
# Edit .env — set JWT_SECRET (or leave blank for auto-generation)
# Set DEPLOYMENT_MODE=local or DEPLOYMENT_MODE=global

# Start (local mode — default)
docker compose up -d

# Or start in global mode (multi-lab with NGINX reverse proxy)
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d
```

Open **http://localhost:3000** → Login: `admin` / `password`

> The server auto-seeds the database on first boot. You'll be prompted to change your password.

---

## ⚡ Quick Start (Manual)

```bash
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims
chmod +x setup.sh

./setup.sh          # Local mode (default)
./setup.sh global   # Global mode

cd server && node index.js
```

> **Windows users:** See [docs/INSTALL.md](docs/INSTALL.md#3-manual-deploy--windows) for PowerShell instructions.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Sample Lifecycle** | Track samples from field → reception → analysis → approval → reporting |
| **Field Data Sync** | Automatic sync with KoboToolbox for field sample intake |
| **Spectral Analysis** | Upload, visualize, and manage MIR/NIR spectral data |
| **3D Field Maps** | Interactive CesiumJS globe with satellite imagery and field photos |
| **Multi-Lab Support** | Full lab-scoped data isolation (Global mode) |
| **Role-Based Access** | Super Admin, Lab Manager, Technician, Reception, Project Manager |
| **Data Export** | Excel, CSV, and PDF with customizable report templates |
| **Equipment Module** | Track instruments, calibration schedules, maintenance logs |
| **Inventory Module** | Manage reagents, consumables, lot tracking |
| **QC Batches** | Analytical batch management with QC checks |
| **Audit Trail** | Complete logging of all system actions |
| **Dark Mode** | Full dark/light theme support |

---

## 🔑 Default Credentials

| Mode | Username | Password | Role |
|------|----------|----------|------|
| Local | `admin` | `password` | LAB_MANAGER |
| Global | `admin` | `password` | SUPER_ADMIN |

> ⚠️ **You must change this on first login.**

---

## 🏗️ Architecture

```
┌───────────────────────────────────┐
│         Browser (Client)          │
│  React · Vite · CesiumJS · i18n  │
├───────────────────────────────────┤
│       Express API Server          │
│  Node.js · JWT · RBAC · WS       │
├───────────────────────────────────┤
│        SQLite Database            │
│  Prisma ORM · Zero-config        │
└───────────────────────────────────┘
```

---

## 📋 Project Structure

```
soilfer-lims/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # React context providers
│   │   └── pages/          # Page components
│   └── public/             # Static assets
├── server/                 # Express backend
│   ├── controllers/        # Route handlers
│   ├── middleware/          # Auth & RBAC middleware
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic
│   ├── utils/              # Audit logger, scope guard, workflow engine
│   ├── prisma/             # Database schema & migrations
│   └── seed.js             # Auto-provisioning script
├── deploy/                 # Deployment configs
│   └── nginx.conf          # NGINX reverse proxy
├── docs/                   # Documentation
│   ├── INSTALL.md          # Full installation guide
│   └── ADMIN_GUIDE.md      # Post-install admin guide
├── docker-compose.yml      # Base Docker config
├── docker-compose.local.yml  # Local mode override
├── docker-compose.global.yml # Global mode + NGINX
├── docker-entrypoint.sh    # Container boot script
├── Dockerfile              # Container build
├── setup.sh                # Manual setup script
└── .env.example            # Configuration template
```

---

## 💾 Backup & Restore

```bash
# Docker
docker cp soilfer-lims:/app/server/prisma/dev.db ./backup-$(date +%Y%m%d).db
docker cp ./backup.db soilfer-lims:/app/server/prisma/dev.db && docker restart soilfer-lims

# Manual
cp server/prisma/dev.db backups/lims-$(date +%Y%m%d).db
```

---

## 🔄 Updating

```bash
git pull origin main
docker compose down && docker compose up -d --build
```

---

## 📚 Documentation

- **[Installation Guide](docs/INSTALL.md)** — Docker, Linux, Windows, SSL, PM2, backups
- **[Admin Guide](docs/ADMIN_GUIDE.md)** — Post-deploy configuration & management

---

## 📄 License

[MIT License](LICENSE)
