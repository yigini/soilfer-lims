# Data Exchange, NSIS / OpenNSIS & API v2

> *Time:* 10 minutes.
> *Who can do this:* Super Administrators, National Leads, Laboratory Managers, and NSIS coordinators.

SoilFER LIMS includes a built-in data exchange gateway (**National SIS & Data Exchange**). National soil portals, GIS teams, and FAO OpenNSIS can harvest approved soil data securely. Daily work in the laboratory continues at full speed.

---

## 1. Four Guarantees That Protect Your Laboratory

1. *Only approved data leaves the laboratory:* External systems can only access samples whose status is **Approved** (**Released**). Samples still in **Sample Reception**, preparation, **Workbench** runs, or **Awaiting Review** are never exposed.
2. *Strict laboratory and country access rules:* Every external integration key is restricted to specific **Authorized Scopes** (**Countries:** and **Labs:**). If a key does not list your laboratory, it receives zero records from your facility (**None (Deny All)** by default).
3. *Zero disruption to bench work:* External harvesting reads from an isolated publication layer. Even if a national database is offline, sample reception, bench entry, and PDF reporting continue normally.
4. *Truthful field and lab origin details:* Missing GPS coordinates or sampling depths stay blank. Decimal depths are kept without rounding. Field collection dates stay separate from laboratory reception dates.

---

## 2. Two Complementary Export Formats

| Export Channel | What It Contains | Best For |
| :--- | :--- | :--- |
| *Spreadsheet Exports (CSV / Excel) & V1 Legacy* | The single final report number per test parameter on each approved sample. Includes its controlled unit, method name, and detection-limit flag. | Agronomists, project coordinators, spreadsheet review, and summary dashboards. |
| *Lossless Exchange (**Default (core-lossless-v2)** & **OpenNSIS (National Accession)**)* | Every valid replicate measurement, raw and normalized values, moisture basis, and batch lineage. Also includes a pointer to the final report number. | National Soil Information Systems, digital soil mapping teams, and spectral calibration libraries. |

---

## 3. Recording Soil Profile References (Pit & Depth Layer Linking)

Field surveyors often collect soil bags from multiple depth layers of the same soil pit (for example, 0–20 cm and 20–50 cm). Recording a soil profile code lets the receiving National Soil Information System link those layers to the same pit:
- At **Sample Reception** (or via **KoboToolbox Integration**), enter the profile code if written on the bag or manifest. If a bag has no profile code, leave it blank. An unknown profile code never blocks laboratory testing.
- Before a sample is approved, reception staff or a **Laboratory Manager** can update the profile reference on the sample detail page. After a report is released, any field origin correction requires an audited report amendment with a written reason.

---

## 4. Manage Integration Keys in Admin Panel

### Steps for Super Administrators

1. Click **Admin Panel** in the left sidebar and select the **National SIS & Data Exchange** tab.
2. Under **Active API Keys**, click **Generate API Key**.
3. Enter a descriptive consumer name (for example, **Guatemala NSIS Node**).
4. Choose the authorized countries (**All Permitted Countries** or specific countries) and laboratories. Then generate the key.
5. Copy the one-time secret key immediately. Share it securely with the national database administrator.
6. Under **Connections & Telemetry**, monitor **Status & Control** (**ACTIVE (Operational)** or **DISABLED (Halt All Keys)**). You can also check **Receiver-Reported Telemetry** (**Receiver Ingested:** and **Receiver Quarantined:** counts).
7. Use the **Step-by-Step Guide** and **Live API Sandbox** tabs (**Test Live with Built-in Sandbox**) to preview the shared data feeds, including **Exchange Capabilities & Profiles**, **Scoped Dataset Statistics**, **Lossless Specimen Registry & Provenance**, **Lossless Tabular Observations Matrix**, **RFC 7946 Spatial GeoJSON FeatureCollection**, **Lossless Spectroscopy Dataset (MIR/NIR)**, and **Monotonic Change Feed & Continuous Sync**.

---

## Related Tasks

- [KoboToolbox Field Integration](./kobotoolbox.md)
- [Spectral Data Management (MIR & Vis-NIR)](./spectral.md)
- [Lab Manager & QA: Certificates of Analysis, PDF Reports & Amendments](./reporting-pdf.md)

---

### For the QA Person

- *Key rotation without downtime:* Integration keys can be rotated with a grace window or revoked immediately from **National SIS & Data Exchange**. Every key creation, rotation, and revocation is logged in **Audit & Security**.
- *Consistent data downloads:* Connected national soil databases can download a complete set of approved results at a fixed point in time and then receive later report updates or withdrawals in order.
