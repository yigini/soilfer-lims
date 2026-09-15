# KoboToolbox Integration

[KoboToolbox](https://www.kobotoolbox.org/) is a free, open-source tool for mobile data collection, widely used by the United Nations, NGOs, and government agencies in developing countries. SoilFER-LIMS integrates directly with it, allowing field data to flow automatically into the laboratory system.

---

## Setting Up the Connection

1. Go to **Settings → KoboToolbox** in your LIMS
2. Enter your KoboToolbox **server URL**:
   - For the free humanitarian server: `https://kf.kobotoolbox.org`
   - For self-hosted instances: your server's URL
3. Enter your **API token** (found in KoboToolbox under Account → Security → API Key)
4. Click **Connect** — the system will verify the connection

---

## Linking a Form to a Project

Once connected, you can link specific KoboToolbox forms to LIMS projects:

1. Go to your project in SoilFER-LIMS
2. Click **KoboToolbox Settings**
3. Select the form that field teams use for sample collection
4. Set the **sync interval** (how often LIMS checks for new submissions):
   - Every 15 minutes
   - Every hour
   - Manual only (you click "Sync Now" when needed)
5. Save

---

## How Sync Works

When a sync occurs, SoilFER-LIMS:

1. Contacts the KoboToolbox API
2. Downloads new submissions since the last sync cursor (`lastSubmissionId`)
3. Creates sample entries in the Reception queue with status `EXPECTED` and `receptionDate: null`
4. Maps form fields to LIMS fields (GPS coordinates, depth, collection date, surveyor, attachments)
5. Generates audit trail entries tracking the synchronization event

The synced samples appear with a **"Synced"** badge in Reception, indicating they originated from a KoboToolbox field submission.

---

## Physical Receipt Authority & Operational Boundaries

A KoboToolbox submission documents field sampling activities and in-transit consignments; **it does not constitute physical receipt by the laboratory**.

Key operational rules:
- **Status Gate**: All imported Kobo samples remain in `EXPECTED` status with `receptionDate: null`. They do not appear in active technician workbenches or preparation queues until physically received.
- **Authoritative Receipt in LIMS**: Physical receipt is performed exclusively by authorized laboratory reception staff in SoilFER-LIMS (`/reception`).
- **Intake Verification**: Staff physically inspect the sample container, verify sample identity and condition, record non-conformances (damage, insufficient volume, leakage), and assign the official Laboratory Sample ID.
- **Audit Compliance**: Confirming receipt updates the sample status to `RECEIVED` / `ACCEPTED`, records the authoritative `receptionDate`, and writes an immutable audit log entry.
- **ISO / GLOSOLAN Traceability**: This strict separation between field registration and physical laboratory intake guarantees chain of custody and prevents phantom samples from corrupting analytical queues.

---

## External Resources

- **KoboToolbox sign-up:** [kobotoolbox.org](https://www.kobotoolbox.org/) (free for humanitarian and research use)
- **KoboToolbox documentation:** [support.kobotoolbox.org](https://support.kobotoolbox.org/)
- **Form design guide:** [KoboToolbox form builder docs](https://support.kobotoolbox.org/creating_forms.html)
- **API documentation:** [KoboToolbox API](https://support.kobotoolbox.org/api.html)
