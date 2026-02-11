# Roles & Permissions

SoilFER-LIMS uses **role-based access control (RBAC)**, meaning each user is assigned a role that determines what they can see and do. This ensures that lab technicians can't accidentally modify system settings, and reception staff can't approve results.

---

## Role Overview

| Role | Summary | Available In |
|------|---------|-------------|
| **Super Admin** | Full system control — creates labs, manages all users | Global mode only |
| **Lab Manager** | Runs one laboratory — manages staff, reviews results, configures settings | Both modes |
| **Lab Technician** | Performs analyses and enters results | Both modes |
| **Sample Reception** | Receives samples and manages the intake queue | Both modes |
| **Project Manager** | Views project data and exports reports (read-only) | Both modes |

---

## Detailed Permissions

### Super Admin (Global Mode Only)

The Super Admin is the highest-level administrator. This role only exists in Global mode, because in Local mode there's only one lab and the Lab Manager handles everything.

**Can do:**
- Create, edit, and delete laboratories
- Create and manage users across all laboratories
- View system-wide statistics and dashboards
- Change system-level settings
- Access all data across all laboratories

**Typical user:** National programme coordinator, IT administrator

---

### Lab Manager

The Lab Manager is responsible for day-to-day operations of a single laboratory. In Local mode, this is the highest role available.

**Can do:**
- Create and manage users within their laboratory
- Assign samples and work items to technicians
- Review and approve or reject analysis results
- Configure which analyses the lab offers
- Create and manage projects
- Export data and generate reports
- View equipment and inventory records
- Manage KoboToolbox integration settings

**Cannot do:**
- Access data from other laboratories (in Global mode)
- Create new laboratories (in Global mode)

**Typical user:** Head of laboratory, senior chemist, lab director

---

### Lab Technician

Lab Technicians are the users who physically perform soil analyses and enter results into the system.

**Can do:**
- View samples assigned to them
- Enter analysis results
- Submit results for review
- View their work history
- Upload spectral data

**Cannot do:**
- Approve results (only submit them for the manager to review)
- Create or manage users
- Change laboratory settings
- Delete samples

**Typical user:** Soil chemist, lab analyst, junior scientist

---

### Sample Reception

Reception staff handle the initial intake of physical soil samples when they arrive at the laboratory.

**Can do:**
- Register new samples (assign lab IDs, record observations)
- View and manage the reception queue
- Match incoming samples with KoboToolbox field submissions
- Mark samples as received, rejected, or requiring additional information

**Cannot do:**
- Enter analysis results
- Approve results
- Manage users or settings

**Typical user:** Lab receptionist, sample intake clerk

---

### Project Manager

Project Managers have read-only access to project data and reports. They can monitor progress but cannot modify data.

**Can do:**
- View project dashboards and statistics
- View sample statuses and results
- Export data to Excel, CSV, or PDF
- View maps of sampling locations

**Cannot do:**
- Create or modify samples
- Enter or approve results
- Change any settings

**Typical user:** Project coordinator, client representative, external reviewer
