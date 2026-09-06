# Antigravity handoff: documentation truth, professional release, and narrow defect corrections

Project: **LIMSI**  
Working folder: `C:\Users\yigin\Documents\soilfer-lims`  
Repository: `https://github.com/yigini/soilfer-lims`  
Starting branch: `main`  
Starting revision reviewed: `6e1dcb0`

## Mission

Correct and professionally finish the documentation update. The public guides must describe the system that actually exists, use safe operational procedures, and avoid unsupported compliance, institutional, security, or interoperability claims. Repair the small application defects uncovered by the documentation review where they prevent a documented feature from working. Verify everything, push the work to GitHub, publish the documentation, and report concrete evidence.

Do not solve a documentation mismatch by inventing a feature or weakening a control. Either implement and test the behavior properly when it is a small, in-scope defect, or change the documentation to describe the present behavior accurately.

## Communication style while working

Keep progress messages friendly and easy to understand. The project owner is not asking for raw terminal output or long internal reasoning.

For each meaningful update, use four short points:

- **Working on:** the current item in plain English.
- **Found:** the relevant fact or problem.
- **Changed/verified:** what is now complete and the evidence.
- **Next:** the next concrete step.

Explain unfamiliar technical terms in one short sentence. Do not say “everything is done,” “production-ready,” or “deployed” until the corresponding checks below have passed. If access or a repository setting blocks a step, say exactly what is blocked and what single action is required.

## Safety and release rules

1. Fetch the remote and confirm the starting tree. Preserve unrelated work.
2. Create a focused branch such as `fix/documentation-truth-and-release`; use a pull request and allow CI to pass before merging to `main`.
3. Never reset, reseed, replace, delete, or edit production data while completing this task.
4. Documentation-site deployment must not redeploy the LIMS application unless an application file was intentionally changed and passed the application release gate.
5. Before any application deployment, run the existing safe online database backup and retain the generated artifact outside the running container. Do not copy the live SQLite `dev.db` file directly.
6. Keep secrets and real credentials out of commits, issues, logs, screenshots, examples, and progress messages.
7. Do not force-push or bypass failing CI. Do not close an issue unless its acceptance criteria are verified on the final deployed revision.

## Workstream 1 — perform a full documentation truth audit

Search all reader-facing sources, not only the files changed in the last two commits. At minimum inspect:

- `README.md`
- `docs/*.md`
- `docs/book/src/**/*.md`
- `docs/book/book.toml`
- `.github/workflows/deploy-docs.yml`
- user-facing assurance text in `client/src`
- certificate/report wording in `client/src/components/report` and `server/services/pdfGenerator.js`

Use repository code, tests, workflows, and configuration as evidence. Do not use comments alone as proof of behavior. Ensure the same fact is stated consistently across the README, installation guide, deployment guide, admin guide, mdBook, quick reference, and maintenance pages.

## Workstream 2 — correct credentials and installation requirements

Remove every statement presenting `admin / password` or the listed GTM/MOZ demonstration users as universal default accounts.

Document the actual fresh-install behavior from `server/seed.js`:

- A fresh database creates one `admin` user.
- Local mode creates a lab-scoped `LAB_MANAGER`; global mode creates a `SUPER_ADMIN`.
- The initial password is randomly generated unless the operator intentionally provides `ADMIN_INITIAL_PASSWORD` during first initialization.
- The generated password is printed once in the seed/startup output and must be changed at first login.
- Additional users are created through authorized administration workflows; they are not guaranteed seed accounts.

Examples must use placeholders such as `<generated-initial-password>`. Never include production usernames or passwords.

Correct the Node.js requirement everywhere. Prisma 7.4 requires a supported runtime of Node.js `^20.19`, `^22.12`, or `>=24`. Prefer Docker as the primary installation path, and give the exact supported ranges for a direct Node installation.

Acceptance checks:

- A repository-wide search finds no default `admin/password` claim.
- A repository-wide search finds no Node 18 support claim.
- Fresh-install instructions agree with `server/seed.js` in local and global modes.

## Workstream 3 — replace unsafe SQLite backup and restore instructions

The application enables SQLite WAL mode. Directly copying a live `dev.db` can omit committed WAL transactions or create an inconsistent backup. Remove this advice from every guide, including README, deployment, installation, upgrading, mdBook maintenance, and quick-reference pages.

Make `server/scripts/backup_db.js` the documented backup path. Explain that it uses SQLite's online backup API, creates a compressed `.db.gz` artifact in `/app/server/backups`, and that this directory is stored in the `lims-backups` named volume. Do not claim it is automatically present under `/opt/soilfer-lims/server/backups` on the host.

Provide copy-and-paste procedures for:

1. Creating an online backup in the running container.
2. Identifying the exact generated filename.
3. Copying that artifact to protected host/off-host storage.
4. Verifying that the gzip file opens and that the restored SQLite database passes `PRAGMA integrity_check` in a disposable environment.
5. Restoring with the application stopped while preserving the named volume. Do not use `docker compose down` followed by `docker cp` into a container that no longer exists.
6. Restarting and checking `/api/health` plus a read-only application smoke test.
7. Backing up uploaded assets separately and documenting retention and recovery ownership.

If the current scripts cannot support a safe, repeatable restore, add a small purpose-built restore or verification script with tests rather than publishing an improvised shell sequence. Test the complete backup/restore procedure against a disposable database or Docker volume. Never test restore against production.

Acceptance checks:

- No guide recommends copying a running WAL database directly.
- The documented commands match the actual container paths and named volumes.
- A disposable backup/restore drill is recorded as passing.

## Workstream 4 — repair Admin navigation and historical-import access

### Admin links

The guides currently link to query parameters that `AdminPanel.jsx` does not reliably consume. The real tab key is `languages`, not `translations`, and Kobo configuration is under Projects rather than the Admin panel.

Choose one consistent solution:

- Implement validated `?tab=` support in `AdminPanel.jsx`, keep the URL synchronized when a tab changes, ignore unauthorized/unknown tabs safely, and add focused tests; or
- Remove the unsupported query links and write accurate click paths.

Use `languages` as the language-tab key. Document Kobo configuration at its actual Projects location. Confirm each published link by opening it as the intended role.

### Historical import

Fix the permission typo on `/admin/legacy-import`: the application defines `RECEIVE_SAMPLE` and the client route currently asks for `RECEIVE_SAMPLES`. Add a focused route/RBAC regression test proving that an authorized intake or manager role can open the importer and an unauthorized role cannot.

Audit the importer end to end before describing it:

- The active importer currently reads text and uses CSV preview/execute endpoints.
- Do not advertise XLS/XLSX support unless those formats are actually parsed, validated, previewed, and tested.
- The project modal labels the function as a roadmap feature and merely routes to the importer. Make this relationship clear and remove file types that are not supported from that modal.
- Do not claim `PRE_DELIVERY_BACKFILL` provenance, special custody isolation, or a dedicated immutable history unless the stored records and tests demonstrate those exact properties. The existing importer uses its actual recorded provenance; document that accurately.
- Clearly explain required columns, preview validation, partial-failure behavior, duplicate handling, permissions, audit events, and rollback limitations.

Keep the import workflow unavailable to unauthorized roles and never test it with production records.

## Workstream 5 — make scientific, reporting, security, and institutional claims defensible

Rewrite claims according to evidence. Use modest, exact language such as “supports,” “provides tools for,” or “designed to align with” when the software helps a laboratory perform a process but does not itself establish accreditation, conformance, or institutional endorsement.

Apply these corrections across the README, guides, mdBook, dashboards, report UI, and generated PDF text:

- Replace “ISO/IEC 17025 compliant/ready” with wording that the platform supports laboratory workflows and records that can contribute to an ISO/IEC 17025 quality system. Accreditation belongs to the laboratory and its validated procedures.
- Do not claim fixed blank, RPD, or CRM thresholds are universal ISO requirements. Describe them as configured/default acceptance rules and state that the laboratory must approve method-specific limits.
- Replace “GloSIS v1.0 compatible/conforming” with accurate export, mapping, or integration wording unless there is a documented conformance profile and passing conformance test.
- Replace “automated SIS exchange” with the exact API/export behavior that exists and note that receiver-side mapping and validation are required where applicable.
- Do not call a report “bilingual” unless a user can select a report language and the complete rendered certificate is translated and tested. Otherwise describe the currently delivered language behavior.
- Replace “digital signature,” “tamper-evident certificate,” and “Digital Seal: VERIFIED / SHA-256” unless the system actually hashes the final report content, binds it to an authenticated signer, verifies it later, and exposes that verification. A manager name/date approval should be called an electronic approval record.
- Replace “zero-dependency PDF engine” with a factual statement such as “server-side PDF generation using PDFKit without a headless browser.”
- Use “audit trail” only for events actually recorded. Avoid “immutable” unless storage-level protections and coverage are verified.
- Treat 40 °C drying, <2 mm preparation, and QC thresholds as configured method/laboratory defaults where that is what the code supports, rather than universal scientific rules.

Review institutional attribution:

- `docs/book/book.toml` must name the actual documentation authors/maintainers.
- Do not state or imply formal FAO, GSP, GLOSOLAN, SoilFER, or ISO endorsement, official branding authorization, or sponsorship without repository evidence supplied by the project owner.
- Keep proper source acknowledgements and licenses, but separate “uses/references guidance from” from “developed or supported by.”
- Remove or qualify badges that imply certification or tested conformance.

Add a short, professional “Scope and validation responsibility” section explaining that laboratories must validate methods, permissions, configurations, instruments, acceptance limits, reporting templates, backups, and local regulatory requirements before operational use.

## Workstream 6 — reconcile the missing director tutorial

The approved tutorial package `WP/director-tutorial-3min-v1` and its overlay implementation are not present in revision `6e1dcb0`, and no tutorial route or `tutorialmode` handling was found in the reviewed repository.

Do not silently describe the tutorial as delivered.

1. Search Antigravity's prior LIMSI/LIMS Dev work, local branches, stashes, worktrees, and commits for the approved package and implementation.
2. If found, recover it on the feature branch and verify it against the approved requirements: three-minute English director walkthrough, multilingual-ready content, login-to-end workflow, five demonstration samples, workflow map, analysis workbench, Kobo/SIS connections, equipment/inventory, and no writes to real LIMS records.
3. Tutorial mode must use isolated demo state or a clearly simulated overlay. Opening, advancing, exiting, or replaying it must not receive samples, assign tasks, submit results, approve records, publish reports, modify configuration, or create production audit events.
4. Accept the intended query and the earlier misspelling as an alias if required: `?tutorialmode=true` and `?tutirialmode=true`, with one canonical URL.
5. If the implementation cannot be recovered, open a GitHub issue that lists the missing acceptance criteria and remove any claim that it is deployed. Do not recreate it from vague memory as part of this documentation correction.

Verify the final status directly on `https://lims.yigini.net` and report one of: **deployed and verified**, **implemented but not deployed**, or **not implemented**. Do not infer status from a successful Git push.

## Workstream 7 — publish the documentation professionally

The mdBook build passes, but GitHub Pages deployment currently fails because Pages is not configured for GitHub Actions. The README must not call the site continuously published while the deployment is red.

1. Confirm whether GitHub Pages is permitted for this repository and account.
2. If permitted, configure repository Pages source to **GitHub Actions**, keep least-privilege workflow permissions, rerun the workflow, and verify the deployed URL returns the current revision's content and assets.
3. If Pages cannot be enabled due to repository visibility, plan, organization policy, or missing permission, remove or clearly label the unavailable site link. Keep the locally buildable mdBook instructions and report the blocker without presenting it as deployed.
4. Make the docs easy for a laboratory operator to scan: consistent terminology, short procedures, expected outcomes, recovery steps, role labels, warnings only where operationally useful, and no decorative claims that obscure instructions.
5. Keep English consistent and professional. Do not use invented product capabilities or marketing superlatives.

Check logo licensing and attribution before publishing. Keeping multiple copies for relative paths is acceptable if necessary, but avoid unexplained duplication and make sure all rendered image paths work on the deployed site.

## Verification gate

Run and record all applicable checks after the final changes:

- `git diff --check`
- Markdown relative-link and image-target validation for `README.md`, `docs/**/*.md`, and `docs/book/src/**/*.md`
- Repository-wide searches for the obsolete credentials, Node 18 requirement, direct live-database copy commands, invalid Admin URLs, unsupported backfill provenance, and overstrong assurance phrases
- `mdbook build docs/book`
- `npm run i18n:check` in `client`
- `npm run lint` in `client`
- `npm run build` in `client`
- `npm test -- --runInBand` in `server`
- Focused tests for every application change, including legacy-import RBAC and Admin tab routing if implemented
- Docker image build
- Disposable backup/restore drill with SQLite integrity verification
- GitHub Actions status after push
- Live GitHub Pages smoke test, if Pages is enabled
- Production application health and read-only role smoke tests only if application code is deployed

The existing baseline was 77 passing server suites and 555 passing tests. Final test counts may be higher. No baseline test may disappear without an explicit, justified explanation.

## GitHub and deployment completion

1. Create or update GitHub issues for each real defect/workstream. Link the pull request and use closing keywords only where acceptance criteria are actually met.
2. Use focused commits with clear messages. Keep generated build directories and secrets out of Git.
3. Push the branch and open a pull request whose description states the factual problems, final behavior, validation, Pages status, application deployment status, backup evidence, and any remaining limitations.
4. Merge only after CI is green and the diff has been reviewed for secrets and unsupported claims.
5. Publish GitHub Pages after merge if the repository setting permits it.
6. If application files changed, deploy the exact merged commit using the project's existing safe deployment procedure after a verified online backup. Confirm the live commit/version, `/api/health`, login, role access, and the corrected routes without modifying production records.
7. Close only fully resolved issues. Leave remaining items open with a specific next action, owner, and acceptance criteria.

## Final report required

Return a concise, plain-English release report containing:

- Branch, pull request, merged commit, and production commit, where applicable.
- Documentation URL and its verified status.
- Files and behaviors changed, grouped by the workstreams above.
- Exact CI/test/build results.
- Backup artifact identifier and restore-drill result, without secrets or sensitive paths.
- Tutorial status using one of the three explicit statuses above.
- Issues opened and closed, with links and the reason for each state.
- Any remaining limitations or blocked repository settings.

Do not declare completion while GitHub Pages is red, the README advertises unavailable content, unsafe backup commands remain, default-password claims remain, required application tests fail, or the tutorial status is ambiguous.
