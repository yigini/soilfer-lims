# National Soil Information System (NSIS) Data Exchange Specification
**Version:** 1.0.0  
**Status:** Approved / Active Contract  
**Protocol:** RESTful JSON / GeoJSON over HTTPS  
**Target Consumer:** National Soil Information Systems (NSIS), FAO OpenNSIS (`sis-database/owl2sql`), and Global Soil Data Portals  
**Authoritative Reference:** SoilFER Build Specification Volume X (WP-38)

---

## 1. Scope and Objective

Under the FAO SoilFER Project (Activity 1.1 / Output 1.2), national soil testing laboratories must reliably interconnect their Laboratory Information Management System (LIMS) with the National Soil Information System (NSIS).

This document specifies the authoritative, versioned machine-to-machine exchange interface provided by SoilFER-LIMS. It standardizes analytical chemistry, physical soil properties, spectral measurements, and geospatial sample coordinates for ingestion into national and global soil spatial databases.

---

## 2. Communication & Authentication

### 2.1 Base URLs
- **Primary Endpoint:** `https://<lims-domain>/api/v1/data-exchange`
- **Legacy Alias:** `https://<lims-domain>/api/v1/sis` *(Maintained for backward compatibility)*

### 2.2 Security & Headers
All requests must be transmitted over encrypted TLS (`HTTPS`). Authentication uses an API Key header:

```http
GET /api/v1/data-exchange/results?labId=GTM-LAB1 HTTP/1.1
Host: lims.yigini.net
X-API-Key: sis_live_a1b2c3d4e5f6...
Accept: application/json
```

Requests without a valid `X-API-Key` or from inactive keys are rejected with HTTP 401 (`INVALID_API_KEY`).

---

## 3. Core API Endpoints

### 3.1 Samples Registry (`GET /samples`)
Returns sample collection provenance, field intake data, GPS coordinates, and laboratory tracking status.

**Query Parameters:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `labId` | string | No | Filter by laboratory identifier (e.g., `GTM-LAB1`, `MOZ-LAB1`) |
| `project` | string | No | Filter by project code (e.g., `SOILFER-US`, `SOILFER-JPN`) |
| `status` | string | No | Filter by sample status (e.g., `APPROVED`, `PUBLISHED`) |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Page size (default: 50, max: 250) |

**Sample Response:**
```json
{
  "total": 1250,
  "page": 1,
  "limit": 50,
  "samples": [
    {
      "id": "GTM-2026-0001",
      "originalId": "S-10492",
      "labId": "GTM-LAB1",
      "projectCode": "SOILFER-US",
      "status": "APPROVED",
      "depthUpper": 0,
      "depthLower": 20,
      "matrix": "SOIL",
      "samplingDate": "2026-05-12T09:30:00Z",
      "receptionDate": "2026-05-14T14:15:00Z",
      "coordinates": {
        "latitude": 14.6349,
        "longitude": -90.5069,
        "elevation": 1502
      }
    }
  ]
}
```

---

### 3.2 Geospatial FeatureCollection (`GET /geojson`)
Streams an RFC 7946 compliant GeoJSON `FeatureCollection` optimized for direct GIS integration (QGIS, ArcGIS, MapServer, GeoNode).

**Sample Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-90.5069, 14.6349, 1502]
      },
      "properties": {
        "sampleId": "GTM-2026-0001",
        "labId": "GTM-LAB1",
        "projectCode": "SOILFER-US",
        "depth": "0-20 cm",
        "status": "APPROVED",
        "pH": 6.45,
        "carbonOrganic": 18.2,
        "nitrogenTotal": 1.75,
        "textureClass": "Clay Loam"
      }
    }
  ]
}
```

---

### 3.3 Analytical Chemistry Matrix (`GET /results`)
Provides the complete tabular metrology for soil chemical, physical, and biological determinations. Every result includes method reference, controlled unit, analytical basis, and provenance.

**Sample Response:**
```json
{
  "totalResults": 3840,
  "results": [
    {
      "sampleId": "GTM-2026-0001",
      "analysisCode": "pH",
      "analysisName": "Soil pH",
      "valueNumeric": 6.45,
      "valueString": "6.45",
      "unit": "pH_units",
      "methodReference": "ISO-10390-2021",
      "methodName": "pH in Water (1:2.5)",
      "basis": "AIR_DRY",
      "provenance": "MEASURED",
      "isValid": true,
      "flags": [],
      "determinedAt": "2026-05-16T11:20:00Z"
    },
    {
      "sampleId": "GTM-2026-0001",
      "analysisCode": "textureClass",
      "analysisName": "USDA Soil Texture Class",
      "valueNumeric": null,
      "valueString": "Clay Loam",
      "unit": "dimensionless",
      "methodReference": "USDA-SSIR-51",
      "methodName": "USDA Textural Triangle Derivation",
      "basis": "OVEN_DRY_EQUIVALENT",
      "provenance": "DERIVED",
      "isValid": true,
      "flags": [],
      "determinedAt": "2026-05-16T11:25:00Z"
    }
  ]
}
```

---

### 3.4 Spectroscopy Signatures (`GET /spectra`)
Provides calibrated raw and baseline-corrected spectral signatures (Mid-Infrared MIR $400\text{--}4000\text{ cm}^{-1}$ and Vis-NIR $350\text{--}2500\text{ nm}$) linked to physical soil specimens.

**Sample Response:**
```json
{
  "sampleId": "GTM-2026-0001",
  "modality": "MIR",
  "instrumentModel": "Bruker ALPHA II",
  "resolution": 4,
  "wavenumberMin": 400,
  "wavenumberMax": 4000,
  "dataPoints": 1801,
  "wavenumbers": [4000, 3998, "..."],
  "absorbance": [0.245, 0.248, "..."]
}
```

---

### 3.5 Incremental Delta Synchronization (`GET /sync`)
Enables automated, bandwidth-efficient national ETL harvesting. Returns only records modified after the specified ISO 8601 timestamp.

**Query Parameters:**
- `since`: ISO 8601 UTC timestamp (e.g., `2026-06-01T00:00:00Z`).
- `limit`: Number of records to return per page (default: 100).

---

## 4. FAO OpenNSIS Semantic Mapping

SoilFER-LIMS parameters are harmonized with the FAO OpenNSIS relational model (`owl2sql` schema):

| LIMS Entity | OpenNSIS Table | Field Mapping | Description |
|---|---|---|---|
| `Sample` | `Site` / `Plot` | `coordinates.latitude`, `coordinates.longitude` | Geographical sampling station |
| `Sample` | `ProfileLayer` | `depthUpper`, `depthLower` | Horizon / depth interval (e.g. 0-20 cm) |
| `Sample` | `Specimen` | `id`, `originalId` | Physical soil specimen |
| `Result` | `Observation` | `valueNumeric`, `valueString`, `determinedAt` | Numerical or categorical finding |
| `Methodology` | `Procedure` | `methodReference`, `name`, `standard` | Standard laboratory procedure |
| `Unit` | `UnitOfMeasure` | `unitCode`, `qudtUnit` | Harmonized SI / QUDT measurement unit |
| `Result.provenance`| `Metadata` | `provenance` (`MEASURED`, `DERIVED`, `PREDICTED`, `IMPORTED`) | Metrological lineage |

---

## 5. Compliance & Verification

A connected laboratory must verify that:
1. `GET /api/v1/data-exchange/stats` reports valid sample counts.
2. At least 100 analytical results validate schema constraints without parsing exceptions.
3. GeoJSON coordinates fall within the sovereign country polygon.
