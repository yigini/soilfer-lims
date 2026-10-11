# Runtime incident on ae64f169

Current production availability failed after the historical completed release.
Pip's observations are read-only. No production operation or cleanup has been
performed during diagnosis. Original receipts, proofs and backups remain retained.

The original crash/event record is retained byte-for-byte in
restart-log-events.json, SHA256
8e96f02ddc3d8356fe5525a1872974b4fd25b5b9f1d337db4b01bca6fca1cd08.
Incident: https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6111806365.
Separate forward diagnosis/conditional containment plan:
https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6111808236.

At17:43:17UTC, restart count46/unhealthy, effective805306368B/768MiB,
NODE_OPTIONS empty, DISABLE_BACKGROUND_JOBS=false. Current exact ae64 image and
both original volumes remain unchanged. Two cycles fetch67 ZMB submissions and
fatally exhaust V8's heap4-5 seconds later. Sample count38773 and aggregate
metadata/fieldMetadata409100756 characters are measured by a read-only SQLite
transaction. The unbounded Sample query in ae64's Kobo controller loads both
JSON columns; this is a strong diagnostic lead, not an owned reproduction yet.
The safe selected KoboConfig fields contain no API tokens. The stalled ZMB
sync clock remains15:57:04.801UTC/cursor41521. Counts Result19, WorkAttempt19,
WorkItem90, ReviewDecision7 and receipts38 are measured, not a complete protected
field preservation assertion. Free bytes121975025664B; the original completed
production receipt remains mode0400/35ab0b82.

Claudio received the measured evidence in the native Lab workflow audit and plan
thread. He owns the separate bounded Kobo fix. Any same-image jobs-OFF containment
needs a NEW proof/operation and explicit operational scope, preserving original
data, image, memory, volumes and existing safety gates. No old-kit/gate reuse,
installer replay, database restore, older image, heap increase or cleanup.
