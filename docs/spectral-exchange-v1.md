# SoilFER-LIMS Spectral Data Exchange Specification (v1)

**Version**: 1.0.0  
**Status**: Active / Production  
**Base Paths**:
- Production Neutral: `GET /api/v1/data-exchange/spectra`
- Legacy Alias: `GET /api/v1/sis/spectra`
- Bulk Export: `GET /api/v1/data-exchange/spectra/export`

---

## 1. Authentication and Authorization

All requests to the Spectral Exchange API must supply an authorized API Key or JWT token.
API Keys are passed using either:
- HTTP Header `X-API-KEY: slims_live_...`
- Authorization Header `Authorization: Bearer slims_live_...`

### Strict Laboratory Scoping (SL-22)
API keys are strictly laboratory-scoped.
- An API key granted access to `["LAB-GTM"]` can **only** read spectra acquired or processed in `LAB-GTM`.
- An API key without an explicit `labs` configuration or empty array is **denied by default** (`[]`).
- Only administrative keys with explicit `["*"]` have global visibility across all laboratories.

---

## 2. Endpoints

### 2.1 Query Spectra (`GET /api/v1/data-exchange/spectra`)

#### Query Parameters:
| Parameter | Type | Default | Description |
|:---|:---:|:---:|:---|
| `limit` | integer | `50` | Number of scans to return per page (maximum 200). |
| `cursor` | string | `null` | Base64-encoded pagination cursor derived from `(timestamp, id)`. |
| `modality` | string | `null` | Spectral modality filter: `MIR` or `NIR`. |
| `qcStatus` | string | `null` | QC disposition filter: `PASS`, `WARN`, `FAIL`. |
| `instrument` | string | `null` | Equipment asset ID filter (e.g. `TEST-EQ-FTIR-01`). |
| `withReference` | boolean | `false` | When `true`, includes paired approved `MEASURED` reference wet chemistry. |

#### Response Format:
```json
{
  "status": "success",
  "meta": {
    "cursor": "eyJ0aW1lc3RhbXAiOiIyMDI2LTA4LTE0VDA5OjEyOjAwLjAwMFoiLCJpZCI6InNwZWMtMDEifQ==",
    "hasMore": true,
    "schema": "spectra/v1",
    "count": 50
  },
  "data": [
    {
      "id": "spec-2026-08-14-gtm-01",
      "sha256": "4a5c8e3f92...",
      "sampleId": "SMP-GTM-2026-001",
      "labId": "LAB-GTM",
      "signal": {
        "quantity": "ABSORBANCE",
        "axisUnit": "WAVENUMBER_CM1",
        "axisDirection": "DESCENDING",
        "isRaw": true,
        "nPoints": 1738
      },
      "acquisition": {
        "equipmentId": "EQ-GTM-FTIR-01",
        "model": "Bruker Alpha II",
        "accessory": "DRIFT",
        "resolution": 4.0,
        "coAddedScans": 32,
        "background": "GOLD",
        "backgroundRef": "GOLD",
        "backgroundAt": "2026-08-14T08:30:00.000Z",
        "scannedAt": "2026-08-14T09:12:00.000Z"
      },
      "preparation": {
        "preparation": "AGATE_100UM",
        "moistureState": "AIR_DRY",
        "windowMaterial": "KBR",
        "replicateNo": 1
      },
      "qc": {
        "status": "PASS",
        "flags": [],
        "approvedAt": "2026-08-14T11:00:00.000Z",
        "reviewedBy": "lab_manager_gtm"
      },
      "reference": [
        {
          "param": "SOC",
          "value": 18.4,
          "unit": "g/kg",
          "method": "GLOSOLAN-SOP-08 dry combustion",
          "basis": "OVEN_DRY",
          "provenance": "MEASURED",
          "resultId": "res-91823"
        }
      ],
      "axis": [4000.0, 3998.0, "..."],
      "values": [0.152, 0.154, "..."]
    }
  ]
}
```

---

### 2.2 Bulk Columnar Export (`GET /api/v1/data-exchange/spectra/export`)

Returns a consolidated bulk JSON dataset of all approved scans, acquisition metadata, and paired reference wet chemistry matching the query and authorized laboratory scope.

```bash
curl -H "X-API-KEY: slims_live_..." \
  "https://lims.soilfer.org/api/v1/data-exchange/spectra/export?modality=MIR" \
  -o mir_training_dataset.json
```

---

## 3. Controlled Vocabularies

### 3.1 Physical Quantities (`signal.quantity`)
- `ABSORBANCE`: Absorbance ($\text{AU} = -\log_{10}(R)$ or $\log_{10}(1/R)$). Values routinely between $-0.1$ and $3.5$ AU.
- `REFLECTANCE`: Fractional reflectance ($R \in [0.0, 1.0]$). Values $>1.2$ are flagged.
- `TRANSMITTANCE`: Fractional transmittance ($T \in [0.0, 1.0]$).
- `REMANENCE`: Kubelka-Munk transformed signal ($f(R) = (1-R)^2 / 2R$).

### 3.2 Axis Units (`signal.axisUnit`)
- `WAVENUMBER_CM1`: Reciprocal centimeters ($\text{cm}^{-1}$), conventional for MIR/FTIR. Standard display order is **descending** ($4000 \to 400\text{ cm}^{-1}$).
- `WAVELENGTH_NM`: Nanometers ($\text{nm}$), conventional for Vis-NIR. Standard display order is **ascending** ($350 \to 2500\text{ nm}$).

### 3.3 Sample Preparation (`preparation.preparation`)
- `AIR_DRY_2MM`: Sieved to $<2\text{ mm}$, air-dried (standard Vis-NIR soil preparation).
- `AGATE_100UM`: Finely ground in agate mortar to $<100\ \mu\text{m}$ (standard MIR preparation).
- `KBR_PELLET`: Diluted 1:100 in KBr pressed pellet (transmission MIR).
- `INTACT_CORE`: Unprocessed aggregate / field-moist intact soil core.

---

## 4. Cursor Pagination and Caching

### Cursor Protocol (SL-24)
1. In the first call, omit `cursor`.
2. The response includes `meta.cursor` and `meta.hasMore`.
3. To retrieve the next page, pass `cursor={meta.cursor}`.
4. When `hasMore` is `false`, traversal is complete.
5. Cursor ordering is guaranteed stable across concurrent uploads via `(timestamp DESC, id DESC)`.

### HTTP Caching & ETags
- Every response sets an `ETag` computed from the response payload SHA-256 digest.
- Clients sending `If-None-Match: {etag}` receive `HTTP 304 Not Modified` when data has not changed.
