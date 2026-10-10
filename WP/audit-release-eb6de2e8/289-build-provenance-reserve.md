# Valid build, pre-copy reserve refusal and new proof

Application: `feac653495d6b8a21e082cec596f1e14672fb389`.
Tooling: `b02238df5ef4da6f91d2757f8a0498c45e7b1326`, 30 guards pass.

The real Docker build completed at 2026-10-10 21:14:48.006477 UTC, after
individually verifying all 2,224 Git blobs and using no production database
mount. Image:
`sha256:159057d56c456a0c7cdef917fd04f53f9a66d6285cc476d7203d63047bfff8e1`.
Declared image size: 413,507,742 bytes.
Build origin:
`/opt/lims/releases/combined-eb6de2e8-main-feac6534-retry-20261010210829Z`.
Build receipt SHA256
`3ccc75f9902de974b55f3f2e39fcf2ef758ad2fe413511b323e9351e0b8b93e2`.
Docker build log SHA256
`ed04e713e64fc5b73cd0e3a230cf64bf8f375f236b12c0f1a2cfefdcd756476e`.
The receipt remains BUILT_ONLY_NOT_DEPLOYED and keeps the actual original tag,
time, source hashes and origin. It does not claim a rehearsal passed.

The cold build reduced available bytes from 11,100,647,424 to 7,582,003,200,
below the 8,589,934,592-byte floor. `rehearse.py` refused before its copy/receipt
section: no fresh-production-copy.db or rehearsal-receipt.json exists in that
origin. The failed service/journal is retained as pre-copy-reserve-refusal.log.
No rehearsal is replayed or relabelled.

Authorized post-build cache-only prune raised available bytes 7,581,593,600 to
9,719,435,264, recovering 2,137,841,664 bytes. Builder cache is now 0 bytes.
No images, volumes or data were pruned. The valid current image/source/build
receipt were reused, with exact byte hashes, in a NEW proof directory:
`/opt/lims/releases/combined-eb6de2e8-rehearsal-feac6534-20261010211834Z`.
Thirty source/metadata file copies are hash-identical; historical failed proof
receipts were excluded. Unit `lims-owned-feac6534-proof-20261010211834z.service`
runs only `rehearse.py`, creating a genuinely new consistent production copy.

Observed by 21:22 UTC: #190 APPLIED, the exact acceptance link APPLIED with
totalChanges=2 and its immediate NO_OP repeat verified, #191 dry zero-blocker
gate passed and #191 APPLIED. This is stage progress, not a PASSED full proof.
Full preservation, remaining installers/repeats, startup READY/memory and
31+6 read-only probes are pending. Merged-main CI 38085615017 has passed the
server suite and is running Docker checks; final green CI remains required.

Reserve coordination: live DB 563,322,880 bytes; assets 3,971,639 bytes.
The proof retains two DB copies, about 1.127 GB, and deployment needs another
stopped-writer backup plus frozen-kit/log allocation while retaining the floor.
At 21:22 UTC available bytes were 8,521,695,232. Pip directly asked Claudio to
coordinate additional safe headroom/storage with YY, and explained the valid
build reuse/provenance for final kit review. No image/volume/data cleanup or
reserve override is authorized. Read-only geometry shows the 120 GiB vda disk
and ext4 partition already occupy the provisioned disk; there is no unallocated
growth to apply. Live #188 remains healthy, zero restarts. No production
installer, review/data action, quiesce or deployment occurred.
