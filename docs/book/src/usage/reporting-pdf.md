# Certificate of Analysis & PDF Reports

SoilFER-LIMS generates analytical reports and **Certificates of Analysis (COA)** structured according to laboratory SOPs and soil testing quality guidelines.

---

## 📄 Server-Side PDF Generation

Reports are compiled using a native, server-side **PDFKit** rendering pipeline:
- **Server-Side Rendering Without Headless Browser**: Generates PDFs directly with PDFKit, eliminating headless Chrome or Puppeteer overhead.
- **Fast Execution**: Streams generated PDF documents directly to the client in milliseconds.
- **True Vector Typography**: Crisply rendered typography, vector badge shields, and tabular layouts.

---

## 🏛️ Certificate Structure & Anatomy

Each generated certificate includes:

1. **Header & Institutional Branding**:
   - Laboratory and programme identification.
   - Quality system alignment notice.
2. **Sample Provenance & Chain of Custody (2-Column Grid)**:
   - Sample ID & Laboratory Registration Number.
   - Field Origin, Sampling Depth Layer (D1/D2), GPS Coordinates, and Sampling Date.
   - Reception Date, Analysis Date, Submitter, and Project Name.
3. **Pre-Analytical Quality Gates Verification**:
   - Confirmation of Sample Reception, Air-Drying ($< 40^\circ\text{C}$), and 2mm Sieving preparation records.
4. **Categorized Analytical Results Table**:
   - Grouped by analytical category (Soil Reaction, Organic Matter, Primary Nutrients, Secondary/Micronutrients, Physical Properties).
   - Shows Parameter, Standardized Controlled Unit, Measured Concentration, Method Reference (e.g. *ISO 10390*, *Walkley-Black*, *Olsen P*), and FAO 5-tier agronomic rating badge.
5. **Soil Diagnostics Callout**:
   - Derived USDA Textural Class and Carbon-to-Nitrogen ($\text{C:N}$) stoichiometric assessment.
6. **Authorization & Electronic Approval Record**:
   - Laboratory Manager electronic approval record, date of approval, and audit log reference.

---

## 🔗 Secure Public Access & Sharing

Certificates can be shared securely with agricultural extension workers, farmers, and government ministries without exposing administrative login credentials:

- **Public Token URLs**:
  ```
  GET /api/reports/public/:token/pdf
  ```
  Delivers binary `application/pdf` directly to the client's browser or download manager.
- **Authenticated Downloads**:
  ```
  GET /api/reports/:reportId/pdf
  GET /api/reports/sample/:sampleId/pdf
  ```
- **Access Control & Revocation**:
  - Valid tokens stream the PDF instantly.
  - Revoked or expired links return an explicit `HTTP 410 Gone`.
  - Non-existent tokens return `HTTP 404 Not Found`.
