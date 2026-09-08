# Offline work and synchronization contract

This is a proposed extension of the current laboratory services, not a working sync API. Full offline operation was explicitly requested. Offline means authorized local capture and preparation, with eventual server validation; it does not create two independent authoritative laboratories.

## 1. Operation policy

| Activity | Offline behavior | Reconnection rule |
|---|---|---|
| Open assigned samples, methods, SOPs and downloaded reports | Read a scoped snapshot with last-sync time and version. | Refresh via authorized deltas; keep released report artifacts frozen. |
| Receive a known project specimen | Capture condition, mass, notes, evidence and requested allowed analyses; record local receipt intent. | Recheck duplicate/receipt status, project/lab scope, method selection and identity. Conflict if already received elsewhere. |
| Walk-in or consignment intake | Create a local intake with stable client ID; use a preallocated official accession only if explicitly issued and governed. | Deduplicate and allocate/reconcile official identity exactly once. Preserve field ID, source metadata and local-to-server mapping. |
| Drying/preparation | Execute downloaded valid checklist and record evidence; show Confirmed on this device, pending sync. | Shared service validates receipt, assignment, SOP and prerequisites; applies one immutable operational receipt. |
| Numeric/texture/QC work | Save raw input plus canonical values, method/unit/basis, qualifiers and evidence; run versioned local checks. | Recheck definitions, calibration/QC, prerequisites, precision and row versions. Texture fractions remain one atomic result group. |
| Local completion and submission | Seal a reviewed local result revision and queue its completion/submission intent. User sees Waiting to send, never server-submitted. | Preserve the existing completion then submission lifecycle; validate dependent attachments and immutable content hash. Commit valid operations in causal order. |
| Spectra/photos/files | Import available local bytes, persist securely, hash and associate with sample/run. Supported local parsing may preview files. | Resume upload, verify bytes and mappings, run authoritative spectral validation/inference. No fabricated successful prediction while the required server model is unavailable. |
| Review/approval | Read downloaded evidence and record review notes or a proposed decision. | Final approval/rejection/release needs a fresh server preview and explicit reconfirmation against the current version. Never replay a stale approval automatically. |
| Inventory consumption/movement | Record physical action/evidence with quantity, location and actor as a pending event. | Reconcile stock versions, reservation and scope; a conflicting quantity needs review, not silent negative stock or lost physical event. |
| Equipment maintenance/calibration evidence | Read snapshot and record service evidence. | Revalidate expiry/qualification and apply according to existing authority. Offline evidence alone cannot automatically requalify equipment. |
| Storage/custody events | Record local movement with source/destination, label and timestamps. | Verify latest custody and actor; conflict if another device changed the same material. Retain the physical record for investigation. |
| Messaging | Optional scoped draft/outgoing queue; label Not sent. | Deliver once after current authorization; recipient is not notified until server acceptance. No cached private inbox by default beyond selected authorized data. |
| User/role/global settings/catalogue/translation publication | Read downloaded reference; allow explicitly labeled local proposal drafts where useful. | Current online permission checks and review/publication remain required. Never queue a privilege change as a blind retry. |
| Reports/export/integrations | Read already-downloaded released artifacts; prepare export request. | Generate/release official reports and send SIS/KoBo/external deliveries online through the existing system. Cached local worksheet printouts are clearly unofficial. |

## 2. Work-pack preparation

“Prepare for offline work” selects a lab, assigned method run/consignment and sample range. Show sample count, method/SOP versions, estimated evidence capacity, expiry, instrument/QC validity and required documents. Download only allowed fields/entities and all dependencies needed for the chosen work. Include five supported locale labels as a bounded bundle, or clearly indicate which languages are locally available; a language change must not strand the offline screen.

Snapshot must include an immutable pack ID, manifest hash/signature, user/lab/device scope, issued/expiry times, declared operation capabilities, assignment/reservation generation, entity versions, operational schema/method revision, glossary release, selected sample/aliquot identities, prerequisite events, instrument qualifications and QC requirements. Server scope is authoritative; client-supplied lab/actor IDs cannot widen it.

Use a staged download and validate hashes/counts before atomically activating the pack. Interrupted download remains Incomplete and cannot claim Ready offline. Retain the last good pack without overwriting unsynced local changes. Pack replacement performs a controlled rebase/review of proposals, not a destructive refetch.

Reconcile existing assignments and optional exclusive device reservation when issuing packs. Another device may still act after reservation expiry; the server must detect that version conflict. Never promise that an offline reservation is an indefinite distributed lock.

## 3. Local persistence and UI states

Repository adapters expose the same transaction semantics on web and native: scoped entity snapshots, draft revisions, immutable outbox operations, attachments, receipts and local indexes. IndexedDB is the web adapter; a tested native database/file adapter is the recommended managed-device implementation. Preferences/localStorage are not stores for analytical evidence.

For an edit: validate format where possible → commit raw/canonical draft and evidence references to the local database → display Saved on this device. Persistence failure leaves an explicit unsaved error and prevents advancing with a misleading success badge. Debounce network traffic, not the only durable copy. Protect cross-tab/process writers using transaction versions and a single active sync worker with recoverable ownership; leases are local coordination, not laboratory authority.

| State shown to staff | Meaning |
|---|---|
| Unsaved changes | Latest input has not reached durable local storage. |
| Saved on this device | Local persistence succeeded; not necessarily sent or accepted. |
| Waiting to sync (N) | N sealed eligible operations await connectivity/authentication. |
| Sending | Transport in progress; no acceptance yet. |
| Saved to server / Submitted to reviewer | Authoritative receipt for this exact content revision received. |
| Needs attention | Conflict, invalidated prerequisite, rejected operation or missing evidence. |
| Sign in to sync | Device evidence preserved, current authentication needed. |
| Offline pack expired | No new privileged work allowed under the old grant; pending records retained. |

Keep transport state separate from domain state: SENT is not ANALYSIS_APPROVED, and network connectivity is not server health. A 401, 403, 409 or 422 is not an “offline” error. Network hints only trigger a scoped connectivity/auth check. Queue counts refer to unique sealed operations, while the UI also shows affected samples and attachments to avoid misleading duplicate totals.

Draft edits may coalesce before sealing if no dependent operation refers to that revision. Once queued for completion/submission, the payload and operation ID are immutable. Further changes create a new draft/revision and explicitly supersede only an unaccepted operation where safe. An already accepted result uses the existing correction/amendment path. Never mutate a queued body under the same idempotency key.

## 4. Command envelope and server interface

Proposed additive routes:

- POST `/api/offline/devices/enroll`, GET/POST work packs and their manifests; scoped revocation/admin views.
- GET `/api/offline/packs/:id` and versioned bounded downloads, with current authentication.
- POST `/api/sync/operations` for a bounded batch of typed commands.
- GET `/api/sync/operations/:operationId` for uncertain-delivery recovery, authorized by actor/scope.
- GET `/api/sync/changes?cursor=...` for scoped ordered deltas and tombstones.
- Attachment session/create, part transfer/status and finalize endpoints with hash checks.

Fit names into project conventions. Do not build an unrestricted request-replay proxy. Whitelist domain commands such as RECORD_INTAKE, CONFIRM_OPERATION, SAVE_WORK_DRAFT, COMPLETE_WORK, SUBMIT_WORK and RECORD_CUSTODY_EVENT. Approval publication stays on its fresh server-confirmed flow.

```json
{
  "protocolVersion": 1,
  "deviceId": "enrolled-device-id",
  "packId": "issued-pack-id",
  "operations": [{
    "operationId": "client-generated-uuid",
    "type": "CONFIRM_OPERATION",
    "target": {"workItemId": "stable-work-item-id"},
    "baseVersion": 7,
    "dependsOn": ["receipt-operation-uuid"],
    "schemaRevision": "downloaded-checklist-revision",
    "capturedAtLocal": "2026-09-08T10:14:20-06:00",
    "deviceSequence": 104,
    "payloadHash": "sha256-of-canonical-envelope-and-payload",
    "payload": {"checklist": [true, true, true], "observations": ""},
    "attachmentIds": []
  }]
}
```

This illustrates transport structure, not a valid production checklist for every method. The authenticated server session identifies the actor, and the issued pack proves scoped eligibility. Payloads use stable entity/component/check IDs and exact versions. Numeric commands include raw input, explicit decimal convention, canonical quantity/qualifier/unit/basis and method identity; never a language-formatted label as an identifier.

Example outcomes are APPLIED, DUPLICATE_APPLIED, WAITING_DEPENDENCY, CONFLICT, REJECTED, AUTH_REQUIRED and SCHEMA_UNSUPPORTED. Return per-operation receipt ID, entity version, domain status, server timestamp and structured localized reason metadata. HTTP 202/transport receipt is not APPLIED. Return 409 for reused ID with different content/actor/type/target and for resolvable stale scientific versions, with scoped comparison data. Preserve existing error semantics where applicable.

## 5. Atomicity, causality and concurrency

For each operation, authenticate and validate device/pack/scope before exposing a prior receipt. Bind deduplication to actor, device, command, target and canonical payload hash. Existing CommandReceipt has a unique idempotencyKey but requires review for transactional coverage and payload binding; do not assume all old mutations are protected.

Insert/reserve the idempotency identity, validate expected entity versions and prerequisites, apply domain writes, create audit/outbox effects and complete the result receipt in the same database transaction. Concurrent duplicate requests either return the same committed outcome or a recoverable in-progress state. Do not check a receipt and then perform an unprotected second mutation. Server notifications/integration emissions need their own transactional outbox or idempotent delivery to avoid duplicate external effects.

The server never accepts an arbitrary client status or “ready=true”. Reuse current scopeGuard, workflowContract, operationalConfirmationService and readiness/validation services in transactional domain methods. Where controller code owns validation, extract it once and use it from online and sync callers with regression tests.

Operations for one target follow their causal chain. If an operation's direct predecessor was applied by this chain, resolve the predecessor's returned version under the declared dependency. Do not replace a stale baseVersion with the latest server version to force a write through. Unrelated concurrent modifications require review. Dependencies that fail block descendants; independent samples continue. Atomic units include one texture panel, one operational receipt and each existing completion/submission unit. Batch presentation does not justify all-or-nothing loss of 40 independent samples.

Client generation UUIDs prevent duplicate local intake creation. New-sample dependencies refer to the original client entity ID until the server atomically records an ID mapping. Retrying a lost intake response returns that same mapping/accession; never allocate a second sample. Do not change existing UUID paths or labels in place.

Delta pulls use a server-side sequence/cursor and tombstones, not only timestamps. Apply scope changes explicitly and never merge newly received data over pending drafts. Cursor expiry triggers a bounded resnapshot while retaining the outbox. Multi-device edits to a result, method, assignment or gate produce a controlled conflict; no last-write-wins and no auto-averaging scientific values.

## 6. Local prerequisite chains and elapsed time

A received-at-server sample can progress locally through downloaded drying/preparation rules, with dependent pending events. A locally received specimen can do so only under the pack's explicit intake/assignment/SOP rules and provisional identity. If an operation requires manager verification, local technician confirmation cannot substitute for it; downstream measurements stay blocked until a verified event is available.

Record actual method-required times, conditions, equipment and evidence; do not infer a physical step completed because a button was tapped or a timer elapsed. Local checks use a pinned validation/schema version to support work, but the server validates again. Method/SOP changes invalidate affected unaccepted operations and require a documented reconciliation decision. A return/rejection of an upstream event blocks pending descendants while preserving their physical evidence.

Store captured device time, timezone/offset, device sequence and server-received time separately. Preserve original claimed time; do not backdate server audit timestamps to hide delayed upload. Clock drift/rollback and questionable calibration-at-measurement time flag review. Device time cannot prove offline authorization or equipment validity on its own. Apply bounded offline-lease policy and server checks; expired or uncertain equipment blocks claiming a valid analytical result, while exception evidence can be recorded.

## 7. Attachments and instrument evidence

Import chosen file bytes into durable scoped storage before acknowledging availability. Save immutable content hash, size, MIME/signature validation, original filename, sample/run/method association and capture/import provenance. For spectra retain original bytes, axes, units, acquisition context and model/reference distinctions. Hash comparison alone is not scientific QC.

Use bounded/resumable upload parts and immutable upload IDs, with server range/part checksum status. Verify final bytes and access scope before marking uploaded. Final analytical completion waits for required evidence finalization. A detached preview URL or photo thumbnail is not proof of upload. Never re-pick a changed file under the same hash/ID or silently recompress original scientific files.

Check capacity before downloading packs or capturing large evidence; reserve headroom and handle disk-full during commit. Photos may have a separately stored optimized preview; retain required originals under lab policy. Do not delete unaccepted outbox/evidence to free space. Release only acknowledged retained content under an explicit retention policy. For very large instrument batches recommend a capable tablet/native device or the bench workstation while retaining mobile file selection/review; publish tested size limits rather than guessing.

Offline inference requires a separately validated, versioned model/runtime that is actually present on device. This plan does not invent that capability. Staff may acquire spectra and queue processing; show Awaiting spectral processing until the authorized pipeline runs.

## 8. Conflict and recovery experience

Sync Centre groups by work pack and sample, with simple counts, last confirmed sync and Retry/Resolve/Sign in actions. A conflict view shows sample and method, local proposal, server value/state, who/when if permitted, and the actual reason. Avoid a blanket “Use mine” that overwrites approved data. Available choices depend on domain authority: keep server value, retain local as a new replicate if the SOP permits, submit a correction request, or rescan/reconcile an intake. Require a reason for scientific reconciliation; reuse existing amendment rules.

On response loss, query/retry the SAME operation ID. On auth expiry, pause network writes, lock protected content as policy requires, preserve encrypted drafts and resume after the same authorized user returns. Switching user cannot take ownership of the old queue. On method/assignment revocation, quarantine affected proposals and route to manager review; never erase their evidence or silently accept them under a different actor.

Process death, app swipe-close, reboot, OS low-memory and version upgrade must recover the queue from storage. A beforeunload handler is not a durability guarantee. Update local schemas transactionally with a backup/recovery path and never clear the database on migration error. Persist retry state with bounded exponential backoff/jitter and manual retry. Failure of a single attachment or sample does not starve independent work.

Logout/device retirement warns about pending records and offers sync or controlled encrypted recovery, while locking credentials and local access immediately. User-requested erasure follows the explicit policy and acknowledges data loss; routine session timeout is not permission to discard work. Device loss before synchronization can lose local-only data even with native storage—mitigate with shift sync practice and an approved encrypted recovery path, never promise zero risk.

## 9. Acceptance invariants

No successful badge before durable save or authoritative receipt, according to its exact label. No duplicate domain effect from retry. No task completion without its prerequisites/evidence. No automatic scientific overwrite or offline final approval. No cross-user/lab data access. No removal of an unacknowledged record during cache cleanup/update/logout. No external integration emission before server authorization. Every pending operation has a visible recoverable disposition.
