# Proposed localization contracts

These are implementation contracts, not endpoints added by this package. Fit them into the existing Express/Prisma conventions and keep current API response fields backward-compatible during migration.

## Published bundles

Keep the public bootstrap route for active locale choices, anonymous default and public bundle versions. Add a scoped authenticated bundle endpoint, for example `GET /api/i18n/bundle?locale=fr`. Server derives allowed lab scope; only an authorized global administrator can explicitly request another scope. Do not expose private translation metadata through public bootstrap.

```json
{
  "locale": "fr",
  "scope": {"type": "LAB", "id": "authorized-lab-id"},
  "manifestVersion": "localization-v1",
  "globalReleaseId": "release-id",
  "labReleaseId": null,
  "messages": {"workbench.action.submit": "Soumettre pour vérification"},
  "etag": "content-hash"
}
```

The shown text is a draft example. Compiled message ASTs may replace plain strings after build/runtime compatibility is validated. Cache keys include actual locale, scope and release IDs. Missing or stale bundles use a known compatible published fallback, not draft or arbitrary English text masquerading as French. Translation-management APIs can return per-key provenance separately.

## Catalogue display identity

An analysis or method remains identified by its current ID/code. Add presentation descriptors without replacing operational fields:

```json
{
  "code": "PH_H2O",
  "name": "Existing canonical catalogue name",
  "display": {
    "nameKey": "dynamic.analysis.PH_H2O.name",
    "descriptionKey": "dynamic.analysis.PH_H2O.description"
  },
  "methodologyId": "actual-selected-method-id",
  "methodRevision": 1,
  "unitCode": "existing-unit-code"
}
```

No localized string is posted as an analysis identifier. Required qualifiers come from the selected method, not a translated name parser. Names can change language while maps, tasks and results retain the same identities.

## Backend semantic messages

Extend the existing message-code contract consistently:

```json
{
  "errorCode": "WORK_PREREQUISITE_INCOMPLETE",
  "errorParams": {"gateCode": "PREPARATION", "sampleId": "S004"},
  "error": "The required preparation is incomplete.",
  "data": null
}
```

The client maps `gateCode` to a domain-localized label before formatting a typed message. It must not translate sample IDs or infer state from the fallback sentence. Preserve current HTTP failure status and the authoritative work restriction. Use one adapter for backend errors, bulk row errors, dashboard reasons and notifications; retain codes/params in evidence.

## Edit operations

Prefer additive scoped routes over reusing the whole-blob `PUT /api/admin/languages/:code` indefinitely:

- `GET /api/admin/translations/catalog?locale=pt&module=workbench&state=needs-review` — paginated, authorized registry and current published/draft/source metadata.
- `POST /api/admin/translations/changesets` — create an explicitly scoped locale change set.
- `PATCH /api/admin/translations/changesets/:id` — changed entries only with base revisions; no full-language overwrite.
- `POST /api/admin/translations/import-preview` — read/validate submitted import content and return a diff, without changing entries.
- `POST /api/admin/translations/changesets/:id/submit` — validate and request review.
- `POST /api/admin/translations/changesets/:id/reviews` — record an authorized review of exact entry/source revisions.
- `POST /api/admin/translations/changesets/:id/publish` — validate scope/review/staleness and atomically publish a release.
- `POST /api/admin/translations/releases/:id/activate` — controlled rollback/activation of a compatible previous release; audit and concurrency required.

Route names are proposals. Keep this behavior if the project chooses a more consistent naming scheme. Do not give lab managers access through branding authority alone.

```json
{
  "baseRevision": 7,
  "changes": [
    {
      "key": "dynamic.analysis.EC.name",
      "expectedEntryRevision": 2,
      "sourceHash": "hash-of-reviewed-source",
      "operation": "set",
      "value": "Condutividade elétrica"
    }
  ]
}
```

`operation: resetOverride` is explicit and restores inherited published wording. A blank string is not a deletion command. Reject unknown/retired-unavailable identities, unsupported locales, wrong scope and changes to protected operational fields. Admin import never edits sample values, method codes or units.

## Conflicts, review and publication

- Use 409 for a stale base/entry revision with the current revision and permitted comparison metadata. Retain the user's draft client-side and offer compare/reapply.
- Use 422 for invalid message grammar/placeholders/source hash or incomplete review, with per-entry codes and localized explanations.
- Use 403 for unauthorized global/other-lab writes and review/publication capability failures. Do not leak other scopes' drafts in error details.
- Review stamps bind to the entry revision and source hash. Editing either invalidates the stamp. Reviewer authority covers the domain and locale.
- Publish requires an idempotency key and expected active-release revision. Duplicate retries return the same outcome; they do not produce repeated releases.
- Activation changes only a pointer to an immutable release. Never rewrite frozen report artifacts or scientific audit history.
- Client saves must reject/rethrow API errors to the editor; only confirmed success clears dirty state. Use “Draft saved” until publication actually completes.

## Coverage metadata

Return separate integer counts for required, missing, draft, needsReview, sourceChanged, reviewed and published. Resolve overlap explicitly: e.g. a stale published entry counts as sourceChanged for readiness, while its served version remains known. Every count uses the same selected scope/module/manifest denominator. Include the server's declared definition of reviewed coverage; it cannot count fallback values as reviewed translations.

## Numeric and report boundary

Localization APIs contain no analytical mutations. Existing result APIs retain canonical values/qualifiers/unit codes and optionally receive an explicit input-format profile through their established validation boundary. Raw text must never be silently reinterpreted after a language switch.

Report generation stores `reportLocale`, template version and global/lab terminology release references with the existing approved snapshot. Viewing a report uses that frozen context, not a mutable current-user translation pack. Translation publication does not invoke report approval/release or change its analytical content.
