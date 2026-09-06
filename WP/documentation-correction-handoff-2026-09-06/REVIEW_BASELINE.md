# Documentation correction review baseline

Reviewed against repository revision `6e1dcb0` on 2026-09-06.

## Verified healthy baseline

- Local `main` matched `origin/main` at the time of review.
- Main CI passed at <https://github.com/yigini/soilfer-lims/actions/runs/34057190073>.
- The reported baseline was 77 server suites and 555 tests passing.
- Client build and Docker build passed in CI.
- The mdBook source compiled.
- Changed Markdown files had no missing repository-relative targets in the review check.
- No real secrets were found in the documentation changes.

## Verified release blockers

- GitHub Pages deployment failed at <https://github.com/yigini/soilfer-lims/actions/runs/34057190071> because Pages was not enabled/configured for GitHub Actions, while the README advertised a continuously published site.
- Default credentials in the guides contradicted `server/seed.js`, which generates an initial password unless `ADMIN_INITIAL_PASSWORD` is supplied.
- The documented Node 18 support contradicted Prisma 7.4's supported Node versions.
- Multiple guides recommended copying the live SQLite database despite WAL mode and the available online-backup script.
- Some restore steps removed the container before attempting `docker cp` into it.
- Admin query links did not correspond to implemented Admin tab routing; Kobo was documented in the wrong area and `translations` did not match the `languages` tab key.
- `/admin/legacy-import` checked the nonexistent plural permission `RECEIVE_SAMPLES`; the real permission is `RECEIVE_SAMPLE`.
- The project historical-backfill modal was labeled as a roadmap handoff to a CSV importer, while the documentation described broader delivered behavior and provenance.
- Compliance, conformance, cryptographic-signature, bilingual-report, tamper-evidence, and institutional-support claims exceeded the implementation or available proof.
- `docs/book/book.toml` attributed authorship to FAO/GSP/SoilFER without repository evidence of formal authorization.
- The approved director-tutorial package and tutorial implementation were absent from the reviewed Git tree.

This file records the review starting point. Antigravity must validate every claim again against its final branch and deployed revision.
