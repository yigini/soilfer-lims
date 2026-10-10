# Retained pre-build packaging refusal

The first preparation dispatch after #289 merge refused before build or any
fresh production database copy. Root:
`/opt/lims/releases/combined-eb6de2e8-main-feac6534-20261010210359Z`.
Unit: `lims-owned-main-feac6534-20261010210359z.service`.
At 21:05:49 UTC, `build-candidate.py` refused `Never replay a retained build`.
The broad raw-kit export had copied the old committed `build-receipt.json`
alongside the sources. That copied receipt does not represent this target or
a new build/rehearsal. It is never used as a new proof. The refused directory
and journal remain retained, and are not replayed or relabelled.

The export now selects only committed Python/Node sources and the two original
YY authorization transcriptions. Historical JSON receipts/gates/manifests stay
in Git and their original proof directories. A new packaging guard exercises
the raw export against an isolated Git fixture and requires all historical
execution receipts to remain excluded while exact source bytes are retained.
A NEW directory will receive the corrected export and fresh application
archive/index, with tests before build. No production data/review action,
installer, quiesce or deployment occurred.

Authorized cache-only prune completed at 21:05:36 UTC in the refused root:
available bytes rose from 9,990,602,752 to 11,164,839,936 on both paths. The
builder reported 5.487 GB of cache; actual filesystem recovery was
1,174,237,184 bytes. All logs remain in that directory. No image, volume or
data pruning was performed.
