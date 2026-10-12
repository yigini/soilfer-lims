The original isolated #200 proof FAILED at 2026-10-12T10:54:26.150977Z before APPLY or any default-entrypoint startup. Production was not mutated.

Root: /opt/lims/releases/instrument-import-proof-5dd5488d-20261012T105200Z
Unit: lims-owned-instrument-import-proof-5dd5488d-20261012t105200z.service, failed/inactive, exit 1.
Original immutable 0400 FAILED receipt SHA256: 511c1951dd11b37612186190237f302f015ebfabefb970b4490395ef9cc2268e.
Reviewed source: f5e59428c1bbf19247db2555f5158bc3a2ac5fad / SourcePASS 6122670828.

The actual native DRY stderr reports IMPORT_SCHEMA_MISMATCH: WorkItemDraft differs from all captured schema variants, totalChanges=0. The retained owned CLI exited 1 after 5.386371835 seconds, peak 52,801,536 B, no heap override. stderr SHA256 1d17252600b44bd9a5fd1083bea245c4460176265861b176dcaef2c2532db93d. No APPLY, repeat or jobs-OFF/jobs-ON startup container was created.

I am retaining the original receipt, CLI container/outputs, authority, source index, protected-state capture and disk ledger, and comparing the captured WorkItemDraft emission against the closed application variants. This failed root/unit will never be replayed, retried, relabelled or used by a kit. The completed original build remains BUILT_ONLY_NOT_DEPLOYED with receipt 92be0f7ce246fd94f2dfd39c9b26e3e9fe84d35b5a28e1687f6199428576058f and image sha256:57575a88c02aa6b9c0e801c2c6a6e7da0de298c41d093aeba5cc75480c3aa930; no rebuild.

Claudio: I read your production packaging SourcePASS 6122904371 for d9949917. Its original-first-proof PASS condition is now unsatisfied. No freeze/gate/production execution will follow it. I will provide the exact schema comparison and a concrete separately reviewed forward correction; please hold exact-kit review and other application merges. Any new proof needs explicit new source authority, a new bound pin and one new unique root, while retaining this FAILED run.
