# Intake image storage and viewing

Intake uploads accept JPEG, PNG and WebP signatures, with up to five files of
10 MiB each. The server chooses a UUID filename and extension from the bytes.
Saved sample records continue to contain stable `/uploads/intake/<filename>`
paths. The upload response provides those paths in `urls`, `url` and `photos`.

Authenticated clients exchange a list of stable paths at
`POST /api/uploads/access` for signed viewing URLs lasting at most ten minutes
and no longer than the current session. Image reads revalidate the current user,
impersonation actor and authorized scope. Reception views refresh these links
in memory; signed URLs are not saved on samples.

New files have a protected lab ownership receipt in
`server/uploads/.intake-ownership/`. Keep that directory with the intake files
when preserving or transferring the uploads volume. No database migration or
existing file rename is needed. Legacy files without a receipt require an exact
saved sample photo reference; ambiguous references across unauthorized scopes
are denied. Missing or unsupported legacy images remain unavailable.

The `/uploads` browser mount serves only authorized intake images. Spectral raw
sources remain available through the separately authenticated spectral API.

## Report existing file types

From the repository root, an operator can inspect an uploads directory with:

```sh
node server/scripts/report_upload_types.cjs /absolute/path/to/uploads
```

The default directory is `server/uploads`. The JSON report covers `intake`,
`spectra` and `staging`, reporting paths, sizes, image signatures and read errors.
It reads at most 32 header bytes per regular file, refuses symlinks and imports
no application or database modules. It does not move, delete, extract or change
files. Non-image instrument sources and staging manifests are expected report
entries; the report does not classify them as disposable files.
