### Merged — release preparation status (not live)

- Merged with `--match-head-commit 6a205db83a7841632a10988006b373f01c596c67` → main `25535b6f62b0d29c6b143a45a9c1db02ed2f229a` (tree `52335aba…`, equal to the accepted head). Note: `main` has no server-enforced branch protection; the head match and exact-head CI were operator safeguards.
- Exact merged-main CI run `37117816283` (job `111187917280`): **success**.
- Clean immutable image `soilfer-lims:v3.5.32-25535b6` (`sha256:72b6b81a…`, revision `25535b6…`), built from an LF-exact archive of the merged commit; the in-image CSS equals the accepted `index-Df7izgw5.css` (`65e7d0a2…`).
- The additive theme migration was rehearsed off-production in the target image on a copy of the database (49 users kept; light/dark carried over; integrity and foreign keys OK; idempotent on a second run).
- **Production is unchanged (`v3.5.31-1265e8a`). Themes are not live.** The controlled release will run only after the operator packet is reviewed; live status will be confirmed independently afterwards.
