The SECOND candidate proof203339Z FAILED at 2026-10-11T20:41:16.504087Z,
exit1: `Owned scheduler/runtime error; retain this failed proof`.
Original root `/opt/lims/releases/runtime-kobo-proof-171dd36c-20261011T203339Z`,
unit `lims-owned-runtime-kobo-proof-171dd36c-20261011t203339z.service`.
Original immutable0400 FAILED receipt SHA256
**66915143d779f7b8b3c17eb474c42390499dde63b5fb41b65bba16565ce27d84**.
Both owned containers are stopped/retained, zero restarts, OOMfalse. Exit137
is the coordinator's deliberate owned stop, not evidence of an OOM.
Do not replay either failed proof, reuse this receipt in a kit, or start a
replacement writer without a separately reviewed correction. Production untouched.

Both jobs-OFF and jobs-ON startup stages passed in113.030s with22NO_OP/0,
21READY/0 and zero startup writes; jobs-OFF31/31 checks and six probes passed.
Jobs-ON reached healthy/0restarts, observed peak229838848B below805306368B,
blank heap override. This failure is the strict scheduler-error refusal,
not a memory or disk-growth failure.

The retained scheduler stderr shows these exact configuration refusals:
- MOZ-LAB1: `[KOBO] Configured project 'MOZL' does not exist in the database.`
- TUR, three configs: `LAB_INACTIVE: Laboratory 'TURSAP LAB' is inactive. Intake disallowed.`

Read-only immutable original sealed baseline confirms Project MOZL absent and
TUR.isActive=0. The original active15-minute config IDs are
ec5a5a67-3f5a-4682-88df-edb0e07e6485 (MOZL),
f24b4f7a-1da7-4320-831e-b9105647f106 (TEST-TURSAP),
a9fc2329-cdfc-408e-aeb2-fa1a9020e66d (TEST3),
edfc27ed-adfe-44f8-8ef6-f159f3ba2fc0 (TURSAP8).
The separate MOZ-LAB1/SOILFER-JPN config completed normally.
No config, lab, project, interval, cursor, timestamp or scientific row was edited.

ZMB-LAB1's first natural completion occurred20:40:39.379686437Z, reporting
155new/1skipped and cursor41622. Its before-start read-only capture contains
101pending IDs, so that count discrepancy is UNRESOLVED and under read-only
diagnosis. The first sync was not sealed or full-preservation verified before
the strict log guard stopped the run. No second natural sync or complete
workload preservation proof exists. This is NOT a PASSED rehearsal.

Claudio: please pin the appropriate separately reviewed correction after
reading these refusals. Any expected-refusal policy must bind exact original
config/lab/project/error evidence and preserve every original row; no generic
scheduler-error whitelist or silent weakening. The155/101 discrepancy also
needs explanation before a new workload proof. I am continuing read-only
diagnosis, retaining this failed copy and all original evidence.

Reviewed source55c18943f569e9b031c8aae008f167ab399473af / approval6113431945
was consumed by this ONE new isolated proof. Valid171dd36c/bac52 build remains
unchanged. No frozen kit, gate, deployment, cleanup, restore, older image,
heap override or replay. Keep291 and further application merges held until
292 is live and your actual post-deploy check passes. Both workload pins remain
labAndHubBuildsOwnedByYY=true / RELEASE_DAY_DISK_ABORTS_ACCEPTED.
