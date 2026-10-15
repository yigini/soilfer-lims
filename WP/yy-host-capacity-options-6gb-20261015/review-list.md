# Read-only host removal options: about 6 GB

Observed 2026-10-15T09:49:42.183331+00:00 to 2026-10-15T09:57:50.549148+00:00. No files, images, containers, cache or settings were changed.

**One exact option totals about 6.083 GB estimated.** It contains 65 explicitly listed unused/unshared cache records, three older standalone backup files, one unused previous Soil Museum image and three closed proof folders. Two backup files are distinct historical restore points without another verified exact copy; their retirement needs your explicit acceptance. The third backup has an independently hash-verified identical copy that stays.

Docker estimates are separate from physical file allocations. Shared image layers are excluded from the image estimate; shared cache records are excluded. Actual Docker space reclaimed can differ. No blanket image/cache prune is approved.

| Review ID | Exact item | Estimated / physical GB | What still depends on it / consequence |
|---|---|---:|---|
| C1–C65 | Exact IDs and per-record bytes in [cache CSV](exact-build-cache-65-records.csv) below | 4.140195 | All InUse=false and Shared=false. No child cache record outside this exact set depends on a selected record. Future builds rebuild these caches; existing images stay. |
| B1 | `/opt/lims/backups/dev_pre_issue155_20261003_132428.db` | 0.563327 | No active/configured/retained-release consumer found. This is a distinct old restore point; another exact copy has NOT been verified. Deleting it retires that historical restore point. |
| B2 | `/opt/lims/backups/dev_pre_issue159_20261003_221538.db` | 0.563327 | No active/configured/retained-release consumer found. This is a distinct old restore point; another exact copy has NOT been verified. Deleting it retires that historical restore point. |
| B3 | `/opt/lims/backups/failed_db_20261004_031055.db` | 0.563327 | Retain /opt/lims/backups/dev_pre_api_dialog218_20261004_031055.db; byte-identical SHA-256 verified. |
| I1 | `soil-museum:prev-20261014-093649` — `sha256:3e90c082c7dad009472e8d911921b4293d6f6fe0c05084737a3b717e75969f96` | 0.245986 estimated unique; 0.839414 logical total | No running/stopped container, exact configuration or retained LIMS release reference found. Retires a previous Soil Museum build. |
| P1 | `/opt/lims/releases/workflow-batch-forward-metadata-cde8c889-20261014T233000Z` | 0.001503 | All 46 file bytes independently matched to published Git blobs; no mount, process-open-file or other release-input reference found. |
| P2 | `/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T020000Z` | 0.002707 | All 22 file bytes independently matched to published Git blobs; no mount, process-open-file or other release-input reference found. |
| P3 | `/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T023000Z` | 0.002810 | All 25 file bytes independently matched to published Git blobs; no mount, process-open-file or other release-input reference found. |

**Total: 6,083,182,001 bytes / 6.083 GB estimated.** If only the verified duplicate backup is acceptable, the same set excluding the other two backups is about 4.957 GB, short of 6 GB.

The running production image, current database, latest backup sets and proof folders without another verified evidence copy are excluded from this review list. In particular, the 050000 raw files and 060000 database files are not candidates. No current input, qualified build or retained stopped container is proposed for removal.

## Exact cache items

| ID | Bytes | GB | Parent IDs | Child IDs | Last used |
|---|---:|---:|---|---|---|
| `hwmb8ohxwxr0k6lwgkiajhbj3` | 654204928 | 0.654205 | jjnxjzhf5aa8dwl7h2h22bvl3 | ii16nkuahw3k022bbk8wttmsu | 2026-10-14T22:38:24.359211778Z |
| `n1fa5pyvop7ggpfi677q4ze21` | 654204928 | 0.654205 | 6b8azuxnoump43t8imofm89y2 | f795ib8252yiyuax69xtreizc, ftp43g75snyetklelnw13ecs6, w7mkbf327i9kjpfz78of5ugc7 | 2026-10-12T03:54:20.068071Z |
| `wjft4dtxcwjq6ighnes75l6g4` | 654204928 | 0.654205 | ugc02s24xentwjsgtnmqdcra4 | r55nvq9c8dsey9ucgbo72lcbt | 2026-10-12T10:49:28.300786215Z |
| `sjubzmk31t2ktj01oxsqbawlk` | 487628800 | 0.487629 | rvsrnbjbssaafciskguqqjt0y | llfw2cygbd371tpm790xgcnmv | 2026-10-12T07:58:52.634731019Z |
| `gmgan77x4huwyx9czaj0yts6z` | 365367296 | 0.365367 | li8rghr0klzly0fwq1nh0bn4v | jjnxjzhf5aa8dwl7h2h22bvl3 | 2026-10-14T22:38:24.444132818Z |
| `9oukyfow25nq6mm4x0ha537lm` | 365346816 | 0.365347 | um9imaz9celmurythu6htujk1 | 6b8azuxnoump43t8imofm89y2, ugc02s24xentwjsgtnmqdcra4 | 2026-10-12T10:49:28.260352122Z |
| `w70wn0pwc1x4xjy4nx3ijqmfc` | 67813376 | 0.067813 | q7fu7qmagfrq6tj6mwebbxui0 | g7xkuhio60pxb81qmyoi79z93 | 2026-10-14T22:38:24.400596635Z |
| `hrf18jw8gcoktj46pegoca277` | 67153920 | 0.067154 | su8065vw9vnv5t657mycyf1or | 1py35nfwzarobg4t5pypd37cs | 2026-10-12T13:55:19.529799846Z |
| `nun7fp8oz8aumw3p1my3dnnuz` | 67153920 | 0.067154 | l9p613t6qcttjhkuuk245fuy8 | ivdxyxjqqauznmd6bcecawify | 2026-10-12T10:49:28.194128831Z |
| `avz0i3b51rss3k2975jshcj98` | 66830336 | 0.066830 | ww2iqiy9jl7fb0a1w57zdr63m | 387wurepjbaznqrae07bro6qw | 2026-10-11T23:12:23.383712875Z |
| `k26kmw0n07jlz7w7cvhqgj8ct` | 66830336 | 0.066830 | woleuhny6gxk79xsemgz9s7rz | qmvr9aqvhe8zrucog32w7qvkx | 2026-10-11T19:37:27.31138246Z |
| `zrbpcjczzkk7jmmbp8sehyrbp` | 66830336 | 0.066830 | v9720hr30wxxuiljcfl4kesv8 | ruodaijz6y9bwg5j09avoxq6u | 2026-10-12T03:54:20.081532952Z |
| `eh2wmupjjxx5ox1uir60fhr7r` | 47210496 | 0.047210 | none reported | none reported | 2026-10-15T00:27:26.503157092Z |
| `kz6l24nd595phfs1t75egn5m2` | 43113664 | 0.043114 | none reported | none reported | 2026-10-14T07:36:54.108942762Z |
| `ii16nkuahw3k022bbk8wttmsu` | 34344960 | 0.034345 | hwmb8ohxwxr0k6lwgkiajhbj3 | 5nyhkca0mg5f8r82pu0g4n776 | 2026-10-14T22:38:24.457177867Z |
| `r55nvq9c8dsey9ucgbo72lcbt` | 34275328 | 0.034275 | wjft4dtxcwjq6ighnes75l6g4 | 3k5x6tfdkulhtu4resmsmgdqr, kveymyrdagpqh9of7fltrkjsq | 2026-10-12T13:55:19.456725839Z |
| `ftp43g75snyetklelnw13ecs6` | 34217984 | 0.034218 | n1fa5pyvop7ggpfi677q4ze21 | rt532pzno559u1k1vf0br624i | 2026-10-12T03:54:20.031328477Z |
| `f795ib8252yiyuax69xtreizc` | 34213888 | 0.034214 | n1fa5pyvop7ggpfi677q4ze21 | 269rtmb97s4lqpuyzhnt9l9kh | 2026-10-11T23:12:23.430551027Z |
| `w7mkbf327i9kjpfz78of5ugc7` | 34213888 | 0.034214 | n1fa5pyvop7ggpfi677q4ze21 | onfmqmq0kfh0w1qvht72s9tll | 2026-10-11T19:37:27.11408674Z |
| `g7xkuhio60pxb81qmyoi79z93` | 33165312 | 0.033165 | w70wn0pwc1x4xjy4nx3ijqmfc | none reported | 2026-10-14T22:38:24.437186561Z |
| `1py35nfwzarobg4t5pypd37cs` | 33120256 | 0.033120 | hrf18jw8gcoktj46pegoca277 | none reported | 2026-10-12T13:55:19.536702343Z |
| `ivdxyxjqqauznmd6bcecawify` | 33120256 | 0.033120 | nun7fp8oz8aumw3p1my3dnnuz | none reported | 2026-10-12T10:49:28.201678072Z |
| `387wurepjbaznqrae07bro6qw` | 33075200 | 0.033075 | avz0i3b51rss3k2975jshcj98 | none reported | 2026-10-11T23:12:23.408977178Z |
| `ruodaijz6y9bwg5j09avoxq6u` | 33075200 | 0.033075 | zrbpcjczzkk7jmmbp8sehyrbp | none reported | 2026-10-12T03:54:20.064684938Z |
| `qmvr9aqvhe8zrucog32w7qvkx` | 33071104 | 0.033071 | k26kmw0n07jlz7w7cvhqgj8ct | none reported | 2026-10-11T19:37:27.167004421Z |
| `5nyhkca0mg5f8r82pu0g4n776` | 12787712 | 0.012788 | ii16nkuahw3k022bbk8wttmsu | unctnx0xivexfssmomm0bejt8 | 2026-10-14T22:38:24.480959623Z |
| `3k5x6tfdkulhtu4resmsmgdqr` | 12546048 | 0.012546 | r55nvq9c8dsey9ucgbo72lcbt | zt15ge7kat4zipi6we1e16qsd | 2026-10-12T13:55:19.546699483Z |
| `kveymyrdagpqh9of7fltrkjsq` | 12546048 | 0.012546 | r55nvq9c8dsey9ucgbo72lcbt | yogvpetm037gsag3n2qlti63h | 2026-10-12T10:49:28.246767772Z |
| `269rtmb97s4lqpuyzhnt9l9kh` | 12394496 | 0.012394 | f795ib8252yiyuax69xtreizc | x7qvxfojl9a5mcwl10eh0z7qd | 2026-10-11T23:12:23.355292811Z |
| `rt532pzno559u1k1vf0br624i` | 12394496 | 0.012394 | ftp43g75snyetklelnw13ecs6 | nuo4q4otat62430btf21fol8b | 2026-10-12T03:54:20.078403587Z |
| `onfmqmq0kfh0w1qvht72s9tll` | 12369920 | 0.012370 | w7mkbf327i9kjpfz78of5ugc7 | qd8ow4zoizcfrq6ljz5pjm2f6 | 2026-10-11T19:37:27.195113979Z |
| `8obsapg4t56k20bauqhkja1sb` | 8990720 | 0.008991 | voxwc3rafmh0304w2e71j23bh | none reported | 2026-10-12T07:58:52.638340229Z |
| `ze8x5vl6qhweaggs39fr8abg7` | 4239360 | 0.004239 | none reported | none reported | 2026-10-12T07:58:52.603136196Z |
| `voxwc3rafmh0304w2e71j23bh` | 4231168 | 0.004231 | llfw2cygbd371tpm790xgcnmv | 8obsapg4t56k20bauqhkja1sb | 2026-10-12T07:58:52.641982078Z |
| `krg3frf5mp5m2o7hm0lq0y5hb` | 1589248 | 0.001589 | none reported | none reported | 2026-10-14T07:36:54.118942727Z |
| `6b8azuxnoump43t8imofm89y2` | 327680 | 0.000328 | 9oukyfow25nq6mm4x0ha537lm | n1fa5pyvop7ggpfi677q4ze21 | 2026-10-11T19:37:27.234724493Z |
| `jjnxjzhf5aa8dwl7h2h22bvl3` | 327680 | 0.000328 | gmgan77x4huwyx9czaj0yts6z | hwmb8ohxwxr0k6lwgkiajhbj3 | 2026-10-14T22:38:24.346130839Z |
| `ugc02s24xentwjsgtnmqdcra4` | 327680 | 0.000328 | 9oukyfow25nq6mm4x0ha537lm | wjft4dtxcwjq6ighnes75l6g4 | 2026-10-12T10:49:28.293691963Z |
| `li8rghr0klzly0fwq1nh0bn4v` | 262144 | 0.000262 | lmz7nae0u12mr0qco1d7xzjdf | gmgan77x4huwyx9czaj0yts6z | 2026-10-14T22:38:24.460190952Z |
| `um9imaz9celmurythu6htujk1` | 262144 | 0.000262 | it5sx5rddiup2lqszu9nuq05b | 9oukyfow25nq6mm4x0ha537lm | 2026-10-11T19:37:27.19078654Z |
| `xurmhj8qufsyx2hvshdn5jz1f` | 131072 | 0.000131 | none reported | none reported | 2026-10-12T08:00:30.366483461Z |
| `unctnx0xivexfssmomm0bejt8` | 53248 | 0.000053 | 5nyhkca0mg5f8r82pu0g4n776 | q7fu7qmagfrq6tj6mwebbxui0 | 2026-10-14T22:38:24.482654892Z |
| `yogvpetm037gsag3n2qlti63h` | 53248 | 0.000053 | kveymyrdagpqh9of7fltrkjsq | l9p613t6qcttjhkuuk245fuy8 | 2026-10-12T10:49:28.263946813Z |
| `zt15ge7kat4zipi6we1e16qsd` | 53248 | 0.000053 | 3k5x6tfdkulhtu4resmsmgdqr | su8065vw9vnv5t657mycyf1or | 2026-10-12T13:55:19.466147343Z |
| `nuo4q4otat62430btf21fol8b` | 49152 | 0.000049 | rt532pzno559u1k1vf0br624i | v9720hr30wxxuiljcfl4kesv8 | 2026-10-12T03:54:20.079963728Z |
| `qd8ow4zoizcfrq6ljz5pjm2f6` | 49152 | 0.000049 | onfmqmq0kfh0w1qvht72s9tll | woleuhny6gxk79xsemgz9s7rz | 2026-10-11T19:37:27.276731532Z |
| `x7qvxfojl9a5mcwl10eh0z7qd` | 49152 | 0.000049 | 269rtmb97s4lqpuyzhnt9l9kh | ww2iqiy9jl7fb0a1w57zdr63m | 2026-10-11T23:12:23.420272399Z |
| `l9p613t6qcttjhkuuk245fuy8` | 45056 | 0.000045 | yogvpetm037gsag3n2qlti63h | nun7fp8oz8aumw3p1my3dnnuz | 2026-10-12T10:49:28.254384104Z |
| `q7fu7qmagfrq6tj6mwebbxui0` | 45056 | 0.000045 | unctnx0xivexfssmomm0bejt8 | w70wn0pwc1x4xjy4nx3ijqmfc | 2026-10-14T22:38:24.356164287Z |
| `su8065vw9vnv5t657mycyf1or` | 45056 | 0.000045 | zt15ge7kat4zipi6we1e16qsd | hrf18jw8gcoktj46pegoca277 | 2026-10-12T13:55:19.516485513Z |
| `v9720hr30wxxuiljcfl4kesv8` | 45056 | 0.000045 | nuo4q4otat62430btf21fol8b | zrbpcjczzkk7jmmbp8sehyrbp | 2026-10-12T03:54:20.110154724Z |
| `woleuhny6gxk79xsemgz9s7rz` | 45056 | 0.000045 | qd8ow4zoizcfrq6ljz5pjm2f6 | k26kmw0n07jlz7w7cvhqgj8ct | 2026-10-11T19:37:27.19732356Z |
| `ww2iqiy9jl7fb0a1w57zdr63m` | 45056 | 0.000045 | x7qvxfojl9a5mcwl10eh0z7qd | avz0i3b51rss3k2975jshcj98 | 2026-10-11T23:12:23.378092842Z |
| `wcy07j6gaq2ncxb005nig5ifk` | 16384 | 0.000016 | none reported | none reported | 2026-10-15T00:27:26.495025518Z |
| `w9anixn64e9x6mh0e078gpil7` | 12288 | 0.000012 | none reported | none reported | 2026-10-12T08:02:50.394997621Z |
| `2oclayd47zvdu3z2qyufrw4xr` | 8192 | 0.000008 | none reported | none reported | 2026-10-14T07:36:54.123118029Z |
| `3o3jhe9lvm5ho4uwxe7x9dbrl` | 8192 | 0.000008 | none reported | none reported | 2026-10-14T07:36:54.113882017Z |
| `45a1za4byofdjvq72otwrdewl` | 8192 | 0.000008 | none reported | none reported | 2026-10-12T07:58:52.61086625Z |
| `llfw2cygbd371tpm790xgcnmv` | 8192 | 0.000008 | sjubzmk31t2ktj01oxsqbawlk | voxwc3rafmh0304w2e71j23bh | 2026-10-12T07:58:52.612990902Z |
| `nnti78ozb93dtj42685voa3h3` | 8192 | 0.000008 | none reported | none reported | 2026-10-12T07:58:52.623668729Z |
| `r4d2pj2j8o8g1xlv40ko0kpva` | 8192 | 0.000008 | none reported | none reported | 2026-10-12T08:02:50.407901216Z |
| `wvgplbyyijr9mp3byfi19ijwv` | 8192 | 0.000008 | none reported | none reported | 2026-10-12T08:00:30.388002892Z |
| `z952xvx6gk9qkjl0rmjigwlx3` | 8192 | 0.000008 | none reported | none reported | 2026-10-15T00:27:26.499081012Z |
| `k9o7avf6s95u611v8gdkdd6e3` | 4096 | 0.000004 | none reported | none reported | 2026-10-12T08:02:50.402735577Z |
| `lz02n8gqryfe52qhdnpc75buo` | 4096 | 0.000004 | none reported | none reported | 2026-10-12T08:00:30.376032279Z |

## Other unused images and remaining dependencies

These are alternatives or held items, not additions to the 6.083 GB total. “Unused” means no current container reference after resolving the OCI manifests, not that no service or historical record needs the image.

| Exact tag(s) and ID | Logical GB | Docker unique estimate GB | Remaining dependencies / status |
|---|---:|---:|---|
| `soilfer/manual-sync:latest`<br>`sha256:e2e1cc1b9ac79a92228913005fbf21dbbe106b5c703cf5ca3d5ac793e8f20f79` | 0.359832 | 0.225827 | Current config: /opt/soilfer-learn/docker-compose.yml:74; 2 retained release/source references; exact files in image CSV/JSON — HOLD_CONFIGURATION_DEPENDENCY |
| `soilfer-lims:audit-combined-eb6de2e8-main-feac6534-retry-20261010210829Z`<br>`sha256:159057d56c456a0c7cdef917fd04f53f9a66d6285cc476d7203d63047bfff8e1` | 1.516865 | 1.337034 | 56 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `soilfer-lims:audit-combined-eb6de2e8-repair-pr-0685d34d-verified-20261010T170400Z`<br>`sha256:e2ed0a732e5e34050e42f7796e1d745cb4e18eb991e049ee804993cdc792c9e6` | 1.516844 | 1.023788 | 4 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `soilfer-lims:audit-combined-eb6de2e8-repair-pr-0685d34d-20261010T164000Z`<br>`sha256:e7ccb759ad57c59399b0df53d8b28629af5b588da76391cf8a511dfc4fdc461c` | 1.517084 | 1.024028 | 3 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `soil-museum:prev-20261014-085302`<br>`sha256:d86193691489ae7570c21d91057b55da08b30c4bbe438b910d04fc132d9f9613` | 0.839253 | 0.662437 | 3 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `soilfer/lab:2026.10b`<br>`sha256:bce8e4ddc1c14984ca8fae679540222afafa0db93c0747a336035715dc504173` | 15.275049 | 15.275049 | On-demand image reference: /soilfer-hub / LAB_IMAGE, /opt/soilfer-learn/.env / LAB_IMAGE; 5 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_CONFIGURATION_DEPENDENCY |
| `lims-qc188:6f72590`<br>`sha256:b02ddff8d7549e981edc49215fef2d54ca654adaa2a8924eceb5d4ea0af00394` | 1.512167 | 0.474491 | 38 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `lims-qc189:dfac90e`<br>`sha256:2cfec7b42ef8ba5758dbd43c6f4bbc702ef42f78abe700a6ed0724e151b5ab5d` | 1.511753 | 0.474077 | 29 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `soilfer-lims:audit-187-a14ff63`<br>`sha256:5bd1553ef324519d5f5633d14a7fb37d6520488df056c79407cc1b5e5ffde7c3` | 1.511935 | 1.332104 | 25 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `soilfer-lims:1.9.0-bbd1683`<br>`sha256:49c54b1920f4836e64a81a558885e19890cfc733b38ad6abc0628130a4963db7` | 1.510886 | 0.412805 | 26 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `soilfer-lims:1.9.0-319ade7`<br>`sha256:c86b215eaac744638f29ab89587fe3ed84eb1f0e18e178c72853623c01f09951` | 1.510886 | 0.412805 | 3 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `soilfer-lims:1.9.0-9f298cc`; `soilfer-lims:rollback-pre-audit23-9f298cc`<br>`sha256:10ed70bd29a9f7220f1532866248b644296f5089057b816a624d5edb3503d5f2` | 1.509100 | 0.471956 | 6 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_RETAINED_RELEASE_OR_OLD_PROTECTION_REFERENCE |
| `temporalio/admin-tools:1.32.0`<br>`sha256:a9f84fb9a374b2374fe2e67c8efc0468ff3f1c66c8a0b14597ec86e349e62bca` | 0.470944 | 0.452946 | Current config: /opt/alitt/docker-compose.yml:95; 3 retained release/source references; exact files in image CSV/JSON; Explicitly protected in the prior image-retention plan — HOLD_CONFIGURATION_DEPENDENCY |

In particular, the 15.275 GB on-demand lab image has no current lab container but is still selected by the running hub’s LAB_IMAGE setting and the deployment environment. It is held. Manual-sync and Temporal admin-tools are also still referenced by their Compose configuration.

## Evidence and limits

All container states and image-manifest consumers were inspected. The dependency search covered 137 current configuration/service/cron files, selected image environment references, selected top-level release authority/scripts, and process/open-file references. It does not establish the absence of every possible manual command or external consumer. Exact dependency paths are retained in JSON and CSV.

Files were measured by allocated blocks; the three proof roots also have fresh du-x totals. Every offered proof-root file was rehashed and matched to a raw Git object at an already published commit. Old standalone backup content was hashed on host only; no SQLite connection or backup content transfer occurred.

Approval is pending for the exact IDs and paths above. Nothing will be deleted, pruned, moved or untagged from this report alone.
