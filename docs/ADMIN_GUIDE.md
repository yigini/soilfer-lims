# 🔧 SoilFER-LIMS — Administration Guide

Post-installation guide for configuring and managing your LIMS deployment.

---

## First Login

1. Open your LIMS URL (default: `http://localhost:3000`)
2. Log in with `admin` / `password`
3. You'll be prompted to change your password immediately
4. Set a strong password (minimum 8 characters)

---

## Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **SUPER_ADMIN** | Full system access, create labs, manage all users (Global mode only) |
| **LAB_MANAGER** | Manage lab users, assign work, review/approve results, configure analyses |
| **LAB_TECHNICIAN** | Perform assigned analyses, enter results, submit for review |
| **SAMPLE_RECEPTION** | Receive samples, assign lab IDs, manage intake queue |
| **PROJECT_MANAGER** | View project data, export reports, read-only access |

---

## Local Mode — Getting Started

1. **Update Lab Details**: Settings → Laboratory → Edit name, address, code
2. **Create Users**: Settings → Users → Create technicians and reception staff
3. **Configure Analyses**: Settings → Analyses → Enable the soil tests your lab performs
4. **Set Up Projects**: Projects → Create a project for your first batch of samples
5. **Start Receiving Samples**: Reception → Begin sample intake

---

## Global Mode — Getting Started

1. **Create Laboratories**: Admin → Laboratories → Create each physical lab
2. **Create Lab Managers**: Admin → Users → Create a LAB_MANAGER for each lab
3. **Lab Managers Set Up Their Lab**: Each manager logs in and configures:
   - Technician accounts
   - Available analyses
   - Projects
4. **Lab Isolation**: Data is automatically scoped — lab staff only see their lab's data

---

## KoboToolbox Integration

To sync field collection data:

1. Go to **Settings → KoboToolbox**
2. Enter your KoboToolbox API URL and token
3. Select the form to sync with a project
4. Set the sync interval (or sync manually)
5. Field samples will appear in Reception automatically

---

## Spectral Data

### Uploading Spectra

1. Go to **Spectral Library → Upload**
2. Select files (CSV or OPUS format for NIR/MIR)
3. Match lab IDs to existing samples (or upload unlinked)
4. Validation runs automatically (wavelength checks, QC flags)

### Review Workflow

```
Upload → PENDING → Validation → VALIDATED → Manager Review → APPROVED / REJECTED
```

Spectra can be reviewed from:
- **Spectral Library page** (batch review)
- **Sample Details page** (per-sample review, also updates spectral status)

---

## Data Export

Available from the **Data Results** page:

- **Excel (.xlsx)** — Full dataset with formatting
- **CSV** — Raw data for analysis
- **PDF** — Formatted reports

---

## System Settings

Go to **Settings → System** to configure:

- **Branding**: App title, primary color, logo
- **Default analyses**: Which tests are enabled for new samples
- **Notifications**: Email/in-app notification preferences

---

## Security Best Practices

1. **Change default passwords** immediately after setup
2. **Use HTTPS** in production (see [INSTALL.md](INSTALL.md#4-reverse-proxy--ssl))
3. **Set a strong JWT_SECRET** (64+ character random string)
4. **Regular backups** (see [INSTALL.md](INSTALL.md#6-backup--restore))
5. **Keep updated** — pull latest releases regularly
