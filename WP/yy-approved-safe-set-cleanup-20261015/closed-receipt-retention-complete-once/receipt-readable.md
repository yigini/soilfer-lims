# Exact approved safe-set cleanup receipt

Authority: [6189633644](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6189633644). Started 2026-10-15T10:20:28.066060+00:00; closed 2026-10-15T10:41:01.285182+00:00. Status: CLOSED_EXACT_APPROVED_SAFE_SET_ATTEMPTED_WITH_ITEM_RESULTS.

| Category and result | Count |
|---|---:|
| cache:REMOVED | 65 |
| proof-folder:SKIPPED_CHANGED | 1 |
| proof-folder:REMOVED | 2 |
| old-backup:REMOVED | 1 |
| unused-image:REMOVED | 1 |

All individual IDs/paths, allocated or estimated bytes, check times and skip reasons are in [item-by-item-results.csv](item-by-item-results.csv). Full immediate reference/hash states and original tool outputs are in [the original receipt](remote-originals/receipt.json).

```
Filesystem     Type    1B-blocks         Used       Avail Mounted on
/dev/vda1      ext4 253548216320 215703334912 27413229568 /
/dev/vda1      ext4 253548216320 215703334912 27413229568 /
/dev/vda1      ext4 253548216320 215703334912 27413229568 /

Filesystem     Type    1B-blocks         Used       Avail Mounted on
/dev/vda1      ext4 253548216320 210994954240 32121610240 /
/dev/vda1      ext4 253548216320 210994954240 32121610240 /
/dev/vda1      ext4 253548216320 210994954240 32121610240 /

```

Observed free-space increase: {"/opt/lims": 4708380672, "/var/lib/containerd": 4708380672, "/var/lib/docker": 4708380672}. This is the before/after filesystem observation; Docker accounting estimates and unrelated live filesystem activity can differ.

Same container IDs: True; full selected name/image/labels, unordered mounts and status/start time comparisons preserved: True. Normal production status: {"HealthStatus": "healthy", "Id": "8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b", "Image": "sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2", "ImageManifestDescriptor": {"digest": "sha256:77d39f27dcfea46eefe7b20428a35b5d3f1ffafb811766630dfccd879816ec88", "mediaType": "application/vnd.oci.image.manifest.v1+json", "platform": {"architecture": "amd64", "os": "linux"}, "size": 10698}, "Labels": {"io.soilfer.forward-owned": "/opt/lims/releases/instrument-import-release-959d17e1-20261012T213000Z", "org.opencontainers.image.description": "Laboratory Information Management System for Soil Analysis", "org.opencontainers.image.revision": "959d17e11c357266f7c2a41b0c84ab76914c591e", "org.opencontainers.image.source": "https://github.com/yigini/soilfer-lims", "org.opencontainers.image.title": "SoilFER-LIMS"}, "Mounts": [{"Destination": "/app/server/prisma", "Driver": "local", "Mode": "z", "Name": "lims_lims-data", "Propagation": "", "RW": true, "Source": "/var/lib/docker/volumes/lims_lims-data/_data", "Type": "volume"}, {"Destination": "/app/server/uploads", "Driver": "local", "Mode": "z", "Name": "lims_lims-assets", "Propagation": "", "RW": true, "Source": "/var/lib/docker/volumes/lims_lims-assets/_data", "Type": "volume"}], "Name": "/soilfer-lims", "OOMKilled": false, "RestartCount": 0, "StartedAt": "2026-10-12T21:51:39.512944007Z", "Status": "running"}.

The two distinct October 3 restore points remain. The verified duplicate keeper remains. No other image, backup, proof folder or container was authorized or requested for removal. No SQL connection, production database content access, Docker restart or daemon configuration change occurred.

Remaining Docker cache accounting: 5579537439 B, of which 5577243796 B is shared with images or in use. The standing cache rule never authorizes removing those protected records.

Standing rule 6189658753 is active under actual YY approval relayed in 6189669837. Future builds/proofs need their own computed requirement plus 10 GB headroom measured fresh. This receipt is not a new proof or build capacity gate.

The local SSH wrapper timed out after1200 seconds; the remote controller continued and CLOSED at10:41:01.285182UTC. Its independently retained original0400 receipt is authoritative. The operation was never replayed. First observer/retainer preparation refusals are retained separately and performed no cleanup.

P1 was skipped before any unlink because the guard expected a flat file-only inventory. The later read-only listing has46 files plus four directories (buildx-client, cache, docker-client, tmp); this is not evidence that any file bytes changed. P1 remains. P2/P3 removed47 files, all immediately stable-hashed against the published Git copy bindings; all93 original list-file copies were independently reverified in Git before dispatch.
