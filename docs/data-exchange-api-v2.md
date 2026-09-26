# National Soil Information System (NSIS) Data Exchange Specification (V2)

**Specification Version:** 2.0.0  
**Schema Identifier:** `2026-09-issue140-v2`  
**Status:** Approved / Active Contract  
**Protocol:** RESTful JSON / RFC 7946 GeoJSON over TLS (HTTPS)  
**Target Consumers:** National Soil Information Systems (NSIS), FAO OpenNSIS (`sis-database/owl2sql`), Global Soil Data Portals (GLOSIS / GSP)  
**Governing Issue:** GitHub Issue [#140](https://github.com/yigini/soilfer-lims/issues/140)  

---

## 1. Scope and Architectural Principles

Under the FAO SoilFER Project, national soil testing laboratories must reliably interoperate with National Soil Information Systems (NSIS) and FAO OpenNSIS. Version 2 of the Data Exchange Gateway establishes a **lossless, auditable, resumable, and fail-closed** data exchange protocol.

### 1.1 Non-Negotiable Contract Guarantees

1. **Zero Production Laboratory Disruption:**
   Laboratory intake, analysis, approval, and amendment workflows remain 100% autonomous. The exchange gateway is a strictly read-only publication adapter and state manager. No mandatory profile entry is imposed on reception staff, and no historical analytical records are mutated.
2. **Strict Release Invariant:**
   External consumers can strictly access specimens whose laboratory lifecycle status is `APPROVED` or `RELEASED`. Unapproved, in-progress, or rejected samples are never exposed under any query condition.
3. **Fail-Closed Laboratory Scoping (IR-14):**
   Every API key must possess an explicit non-empty list of authorized laboratory identifiers (e.g. `["GTM-LAB1"]` or `["*"]`). API keys with null, missing, or empty lab scopes receive zero records (`status: 200` with empty array, or `403 Forbidden`).
4. **Truthful Spatial Coordinates & RFC 7946:**
   Coordinates are strictly WGS84 decimal degrees `[longitude, latitude]` or `[longitude, latitude, elevation]`. Null coordinates remain truthful `null` (never coerced to `[0, 0]`). Zero coordinates (`0.0, 0.0`) are valid if genuinely collected (e.g., Gulf of Guinea). Root `crs` objects are omitted per RFC 7946.
5. **Truthful Depth Horizons:**
   Decimal depths (e.g., `0.0` to `15.5` cm) are preserved as exact IEEE 754 floats without truncation or integer rounding. Missing depth values remain truthful `null` (never defaulted to `0–20 cm`).
6. **Separation of Concerns:**
   Field collection dates (`collectionDate`) are strictly distinguished from laboratory physical intake timestamps (`receptionDate`). Physical specimen arrival at the laboratory is never inferred from GPS capture or barcode printing timestamps.
7. **Lossless Observations & Replicate Fidelity:**
   Analytical observations retain individual determinations across replicate measurements (`replicateNo: 1, 2, ...`). Results for the same analyte are never clobbered or collapsed into an arbitrary single value.
8. **Resumable Snapshots & Monotonic Change Feed:**
   Consumers can either generate point-in-time durable snapshots or stream continuous changes using opaque boundary cursors (`updatedAt` + `id`). Expired cursors return HTTP 410 (`CURSOR_EXPIRED`).

---

## 2. Communication & Authentication

### 2.1 Base URLs
- **Primary Endpoint:** `https://<lims-domain>/api/v2/data-exchange`
- **Legacy Alias:** `https://<lims-domain>/api/v2/sis` *(Maintained for backward compatibility)*
- **V1 Legacy Interface:** `https://<lims-domain>/api/v1/data-exchange`

### 2.2 Security & Headers
All requests must be transmitted over encrypted TLS (`HTTPS`). Authentication uses an API Key header:

```http
GET /api/v2/data-exchange/samples?limit=10 HTTP/1.1
Host: lims.yigini.net
X-API-Key: slims_live_a1b2c3d4e5f6...
Accept: application/json
```

Alternatively, the HTTP `Authorization` header may be used:
```http
Authorization: Bearer slims_live_a1b2c3d4e5f6...
```

The gateway also accepts authenticated browser user sessions (JWT) for the interactive administrative API explorer.

---

## 3. Endpoints Reference

### 3.1 Exchange Capabilities (`GET /capabilities`)
Public machine-discovery endpoint declaring server contract version, supported profiles, formats, and retention limits.

- **Auth:** Optional (if provided, indicates authentication status and key role).
- **HTTP Method:** `GET`
- **Path:** `/api/v2/data-exchange/capabilities`

**Response Example:**
```json
{
  "status": "success",
  "contractVersion": "2.0.0",
  "schemaVersion": "2026-09-issue140-v2",
  "sourceSystemId": "soilfer-lims-core",
  "supportedProfiles": ["opennsis", "glosis", "default"],
  "supportedMatrices": ["SOIL", "PLANT", "WATER", "FERTILIZER"],
  "limits": {
    "defaultLimit": 50,
    "maxLimit": 500,
    "maxBboxFeatures": 5000,
    "snapshotTtlHours": 24,
    "cursorRetentionHours": 72
  },
  "endpoints": {
    "capabilities": "/api/v2/data-exchange/capabilities",
    "samples": "/api/v2/data-exchange/samples",
    "observations": "/api/v2/data-exchange/observations",
    "geojson": "/api/v2/data-exchange/geojson",
    "stats": "/api/v2/data-exchange/stats",
    "spectra": "/api/v2/data-exchange/spectra",
    "snapshots": "/api/v2/data-exchange/snapshots",
    "changes": "/api/v2/data-exchange/changes",
    "receipts": "/api/v2/data-exchange/receipts"
  },
  "features": {
    "resumableSnapshots": true,
    "cursorChangeFeed": true,
    "losslessObservations": true,
    "strictProfileFiltering": true,
    "deliveryReceipts": true
  }
}
```

---

### 3.2 Dataset Statistics (`GET /stats`)
Returns aggregated specimen, observation, and laboratory metrics scoped strictly to authorized laboratories and published statuses.

- **Auth:** Required (`X-API-Key`).
- **HTTP Method:** `GET`
- **Path:** `/api/v2/data-exchange/stats`

**Response Example:**
```json
{
  "status": "success",
  "schemaVersion": "2026-09-issue140-v2",
  "sourceSystemId": "soilfer-lims-core",
  "data": {
    "totalSamplesPublished": 1420,
    "totalApprovedObservations": 12840,
    "authorizedLaboratories": ["GTM-LAB1"],
    "authorizedCountries": ["GTM"],
    "activeProfiles": ["SOILFER-GTM", "opennsis"]
  }
}
```

---

### 3.3 Lossless Specimen Registry (`GET /samples`)
Returns paginated specimens with complete provenance, truthful spatial coordinates, unrounded depth horizons, distinct collection/reception timestamps, and resolved profile keys.

- **Auth:** Required (`X-API-Key`).
- **HTTP Method:** `GET`
- **Path:** `/api/v2/data-exchange/samples`

**Query Parameters:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `profile` | string | No | `core-lossless-v2` (default) or `opennsis`. When set to `opennsis`, enforces that samples have genuine laboratory accession identifiers (`labId IS NOT NULL`). |
| `country` | string | No | ISO country code filter (e.g., `KEN`, `ZMB`, `GTM`). Scoped to key permissions. |
| `project` | string | No | Project code filter (e.g., `SOILFER-GTM`). |
| `labId` | string | No | Laboratory identifier filter (e.g., `GTM-LAB1`). Must be within authorized labs. |
| `limit` | integer | No | Page size (default: 50, max: 500). |
| `cursor` | string | No | Opaque pagination cursor for cursor-based navigation. |

**Specimen Object Schema:**
```json
{
  "specimenId": "550e8400-e29b-41d4-a716-446655440000",
  "fieldSampleId": "FIELD-2026-001",
  "labSampleId": "LAB-GTM-2026-0042",
  "sourceSystemId": "soilfer-lims-core",
  "laboratoryId": "GTM-LAB1",
  "projectCode": "SOILFER-GTM",
  "country": "GTM",
  "matrix": "SOIL",
  "status": "APPROVED",
  "spatial": {
    "type": "Point",
    "coordinates": [-90.5069, 14.6349, 1500.0],
    "crs": "urn:ogc:def:crs:OGC:1.3:CRS84",
    "uncertaintyMeters": null
  },
  "depth": {
    "topCm": 0.0,
    "bottomCm": 15.5,
    "horizon": "Ap",
    "samplingMethod": "CORE_AUGER"
  },
  "temporal": {
    "collectionDate": "2026-04-10",
    "receptionTimestamp": "2026-04-12T14:30:00.000Z",
    "approvalTimestamp": "2026-04-15T11:20:00.000Z"
  },
  "profile": {
    "namespace": "SOILFER-GTM",
    "code": "PLOT-ALPHA",
    "resolvedKey": "SOILFER-GTM:PLOT-ALPHA",
    "relation": "HORIZON_OF"
  },
  "observationsCount": 8,
  "hasSpectra": true
}
```

---

### 3.4 Specimen Detail (`GET /samples/:specimenId`)
Retrieves full specimen provenance, complete observation records, and spectroscopy metadata linked to the specimen.

- **Auth:** Required (`X-API-Key`).
- **HTTP Method:** `GET`
- **Path:** `/api/v2/data-exchange/samples/:specimenId`

---

### 3.5 Lossless Analytical Observations Matrix (`GET /observations`)
Returns tabular soil determinations. Each record represents a single analytical determination preserving replicate determinations, analytical basis, censoring indicators, and standard units.

- **Auth:** Required (`X-API-Key`).
- **HTTP Method:** `GET`
- **Path:** `/api/v2/data-exchange/observations`

**Query Parameters:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `param` | string | No | Filter by analyte code (e.g., `PH_H2O`, `SOC_WALKLEY_BLACK`). |
| `basis` | string | No | Filter by moisture basis (`AIR_DRY`, `OVEN_DRY_105`, `AS_RECEIVED`). |
| `censoring` | string | No | Filter by censoring status (`NONE`, `LT_LOD`, `GT_ULOD`). |
| `limit` | integer | No | Page size (default: 100, max: 1000). |
| `cursor` | string | No | Opaque pagination cursor. |

**Observation Object Schema:**
```json
{
  "observationId": "res-9102-1",
  "specimenId": "550e8400-e29b-41d4-a716-446655440000",
  "analyte": {
    "code": "PH_H2O",
    "name": "Soil pH (1:2.5 H2O suspension)",
    "procedureUri": "https://w3id.org/glosis/model/procedure/pH_H2O_1_2.5"
  },
  "asMeasured": {
    "value": 6.4,
    "rawValue": "6.40",
    "unit": "pH_units"
  },
  "normalized": {
    "value": 6.4,
    "unit": "pH_units",
    "qudtUri": "http://qudt.org/vocab/unit/PH"
  },
  "metrology": {
    "replicateNo": 1,
    "basis": "AIR_DRY",
    "censoring": "NONE",
    "lod": 1.0,
    "loq": 2.0,
    "uncertainty": null
  },
  "method": {
    "id": "m-gtm-ph-01",
    "name": "Potentiometric pH (1:2.5 Water)",
    "isoStandard": "ISO 10390:2021"
  },
  "determinedAt": "2026-04-14T09:15:00.000Z"
}
```

---

### 3.6 Spatial GeoJSON FeatureCollection (`GET /geojson`)
RFC 7946 compliant GeoJSON stream for GIS systems (QGIS, ArcGIS, GeoNode).

- **Auth:** Required (`X-API-Key`).
- **HTTP Method:** `GET`
- **Path:** `/api/v2/data-exchange/geojson`

**Compliance Features:**
- Coordinates in WGS84 `[longitude, latitude]` format.
- Samples with null coordinates are omitted from spatial features.
- Root `crs` property is intentionally omitted per RFC 7946 §4.
- Stable string feature `id` matching `specimenId`.

---

### 3.7 Spectroscopy Dataset (`GET /spectra`)
Provides calibrated spectral signatures (Vis-NIR 350–2500 nm and MIR 400–4000 cm⁻¹) linked to physical soil specimens.

- **Auth:** Required (`X-API-Key`).
- **HTTP Method:** `GET`
- **Path:** `/api/v2/data-exchange/spectra`

**Query Parameters:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `modality` | string | No | `MIR` (default) or `NIR`. |
| `limit` | integer | No | Maximum number of spectra to return. |

---

### 3.8 Resumable Export Snapshots (`POST /snapshots`, `GET /snapshots/:snapshotId/pages`)
Allows consumers to freeze a point-in-time manifest across the dataset and harvest it page-by-page without drift from concurrent lab publications.

- **Creation:** `POST /api/v2/data-exchange/snapshots`
  - Body: `{ "profile": "core-lossless-v2", "pageSize": 100, "filter": { "country": "GTM" } }`
  - Response: `{ "snapshotId": "snap_17904...", "boundaryTimestamp": "...", "totalItems": 1200, "totalPages": 12, "expiresAt": "..." }`
- **Reading Pages:** `GET /api/v2/data-exchange/snapshots/:snapshotId/pages?limit=100&cursor=...`
  - Returns items locked to the snapshot boundary sequence.
  - Snapshots persist for 24 hours (TTL) in durable exchange storage.

---

### 3.9 Continuous Synchronization Change Feed (`GET /changes`)
Monotonically ordered feed of publication and withdrawal events for automated incremental harvesters.

- **Auth:** Required (`X-API-Key`).
- **HTTP Method:** `GET`
- **Path:** `/api/v2/data-exchange/changes`

**Query Parameters:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `cursor` | string | No | Opaque boundary cursor received in previous response. |
| `limit` | integer | No | Maximum number of events (default: 100, max: 500). |

**Change Feed Event Schema:**
```json
{
  "status": "success",
  "schemaVersion": "2026-09-issue140-v2",
  "boundaryTimestamp": "2026-09-27T00:15:00.000Z",
  "count": 2,
  "hasMore": false,
  "nextCursor": "eyJsYXN0VXBkYXRlZEF0IjoiMjAyNi0wOS0yN1QwMDoxNDowMC4wMDBaIiwibGFzdElkIjoidjItc3BlY2ltZW4tMSJ9",
  "changes": [
    {
      "eventType": "PUBLICATION",
      "specimenId": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2026-09-27T00:14:00.000Z",
      "specimen": { "specimenId": "...", "status": "APPROVED", "observationsCount": 8 }
    }
  ]
}
```

**Cursor Expiration Behavior (HTTP 410):**
If a consumer passes an invalid, malformed, or expired cursor, the gateway responds with HTTP 410:
```json
{
  "error": "CURSOR_EXPIRED",
  "code": "CURSOR_EXPIRED",
  "message": "Invalid or expired cursor. Please initialize a fresh synchronization snapshot."
}
```
The consumer should catch HTTP 410, create a new snapshot via `POST /snapshots`, and reset its checkpoint.

---

### 3.10 Consumer Delivery Receipts (`POST /receipts`)
Enables external consumers (e.g. OpenNSIS ingestion pipeline) to acknowledge successful ingestion batches and record delivery receipts.

- **Auth:** Required (`X-API-Key`).
- **HTTP Method:** `POST`
- **Path:** `/api/v2/data-exchange/receipts`

**Request Body:**
```json
{
  "snapshotId": "snap_1790461148749_eb88d95e",
  "consumerSystemId": "opennsis-kenya-pilot",
  "recordsReceived": 100,
  "importedCount": 98,
  "quarantinedCount": 2,
  "checkpoint": "eyJsYXN0VXBkYXRlZEF0IjoiMjAyNi0wOS...",
  "status": "SUCCESS",
  "notes": "Batch 1 ingested successfully with 2 spatial warnings."
}
```

**Response Example:**
```json
{
  "status": "success",
  "schemaVersion": "2026-09-issue140-v2",
  "sourceSystemId": "soilfer-lims-core",
  "receipt": {
    "receiptId": "rec_1790461148894_cb7fa653",
    "connectionId": "Kenya National SIS Node",
    "receivedAt": "2026-09-27T00:18:00.000Z",
    "status": "ACKNOWLEDGED"
  }
}
```

---

## 4. Error Handling and Status Codes

| Status Code | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Malformed parameters, invalid limit, or missing required fields. |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing, invalid, or revoked API key. |
| `403 Forbidden` | `FORBIDDEN` | Scoping violation (accessing laboratory or country outside key permissions). |
| `404 Not Found` | `NOT_FOUND` | Requested specimen or snapshot does not exist. |
| `410 Gone` | `CURSOR_EXPIRED` | Pagination or change feed cursor expired. Consumer must re-synchronize. |
| `500 Internal Error`| `INTERNAL_ERROR` | Unexpected server failure. Safe state preserved. |

All error responses return structured JSON:
```json
{
  "error": "UNAUTHORIZED",
  "code": "UNAUTHORIZED",
  "message": "Missing API authentication. Provide an X-API-KEY header or Bearer token."
}
```
