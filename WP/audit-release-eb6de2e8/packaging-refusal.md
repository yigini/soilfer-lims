The expanded repair's first full-copy trial passed every repaired APPLY path
(#193/#191/#192/#194/#197/#201), then refused #211 dry-run with
`REPORT_REVISION_SOURCE_MISMATCH`, `totalChanges: 0`.

Pip traced this to Windows Git archive applying the checkout's CRLF conversion
to files without explicit attributes. The committed #211 SQL is 2,330 bytes,
SHA256 `3acf8e97469c826b163f956e0701841143144d7fcd982fee3ba85151acfefe52`.
The initial exported and Docker-packaged SQL was 2,367 bytes,
SHA256 `7863731d646594bb0e53508d8a6018387b41762d8e04321f72d162c36de005f6`.
The installer correctly refused those unreviewed bytes. No #211 source, loader,
DDL digest or refusal guard is changed or bypassed to address this packaging
mistake.

The failed receipt remains at
`/opt/lims/releases/combined-eb6de2e8-repair-pr-0685d34d-20261010T164000Z/rehearsal-receipt.json`,
SHA256 `52d022c04b919e4908755ff434a4e10fb24983af3ba0d40f10cc2ad0e5e10a0c`.
No production operation occurred.

The replacement export uses `git -c core.autocrlf=false archive`. A separate
read-only index hashes every committed Git blob; the Docker builder now checks
all 2,223 archive members against those bytes before extraction/build. The
corrected archive SHA256 is
`134ba62480d6fa25e9540696225e6f668cdbe9a3d6c8cd57fb0a41f7a4131701`;
the Git-object index SHA256 is
`f65bbf1b9791575a19309b2967a737ce6bee0d250386be1d597146cc6df41c71`.
The #211 archive bytes have been directly compared with the Git blob and match.

A new exact-head image and fresh production-copy proof are running under a new
owned directory. PR #287 remains at
`0685d34d851ef6f115ae88bc772679929d8eee25`; application code is unchanged.
This is not a passed full-entrypoint rehearsal or an audit request yet.
