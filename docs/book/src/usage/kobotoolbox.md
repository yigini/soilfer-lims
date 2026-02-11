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
2. Downloads any new submissions since the last sync
3. Creates sample entries in the Reception queue
4. Maps form fields to LIMS fields (GPS coordinates, soil depth, observations, etc.)
5. Downloads attached photos and links them to the sample

The synced samples appear with a **"Synced"** badge in Reception, indicating they came from KoboToolbox. Reception staff then match these entries to the physical samples when they arrive at the lab.

---

## External Resources

- **KoboToolbox sign-up:** [kobotoolbox.org](https://www.kobotoolbox.org/) (free for humanitarian and research use)
- **KoboToolbox documentation:** [support.kobotoolbox.org](https://support.kobotoolbox.org/)
- **Form design guide:** [KoboToolbox form builder docs](https://support.kobotoolbox.org/creating_forms.html)
- **API documentation:** [KoboToolbox API](https://support.kobotoolbox.org/api.html)
