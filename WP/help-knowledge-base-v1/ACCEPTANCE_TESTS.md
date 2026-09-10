# Help system acceptance and release tests

These are implementation requirements. Prototype tests demonstrate the design only.

| Area | Test and required outcome |
|---|---|
| Route coverage | Every current route and embedded critical surface has a defined help mapping; specific routes win over `/samples/:id`. Unknown routes show generic help without exposing arbitrary IDs. |
| No data mutation | Opening/searching/reading/closing help, clicking a FAQ and switching help language produce no receipt/result/approval/stock/integration mutation requests. Reader navigation never executes article commands. |
| Work preservation | Type an unsaved value in each numeric, panel, checklist, intake, attachment and admin form; open help, article and back; rotate/resize; return with raw input, focus and position preserved. Test the actual application, not mock state. |
| Live blockers | Feed each observed readiness code and combinations. Context explains the server decision without recomputing it. Missing/unknown code keeps original error and generic guidance; does not invent a prerequisite. |
| Result authority | No guide link bypasses assignments, sealed results, required verification or amendment rules. Buttons navigate to the authorized task only. |
| FAQ consistency | Question, short answer, full article, search snippet, contextual panel, print and offline export select the same approved revision/locale. |
| Search | Exact title, topic, pH, MIR/NIR, prep/preparation, typos/synonyms where supported, accents and all five locales; real counts, pagination, empty/loading/failure states. No regex/HTML injection from a query. |
| Scope | Global public, authenticated, restricted and two-lab fixtures. A user cannot obtain another lab's note or draft through search counts, IDs, exports, attachments, history, cache or pack URLs. Persona selection cannot grant access. |
| Publication | Two editors conflict cleanly; editing published content creates a new revision; approval and publish require server capabilities and expected version. Failed publish leaves the prior coherent article/index available. Audit actor/scope/time are correct. |
| Translation | Every launch article and UI state has reviewed en/es/es-419/fr/pt. Source changes invalidate matching translation approvals; stale/missing content is labelled and cannot count as complete. Check long titles, accents, screen-reader labels and printed output. |
| Scientific review | Verify task steps against the actual deployed UI and lab SOP. No fabricated format support, numeric bounds, classification, offline capability, reviewer name or certification claim. |
| Local notes | Lab managers only edit authorized notes for their lab; cannot silently replace mandatory global guidance. Notes display scope, owner and review status. |
| Content safety | Imported script, executable MDX, event handlers, unsafe links, SVG/script payloads and malicious Markdown fail validation/sanitization. Check snippets, history/diff and exports as well as the reader. |
| Support | No configured contact → honest unavailable/configuration message. Draft preview excludes tokens/queries/results by default; attachments and destination are visible before explicit send. No automatic mailing to an address from old docs. |
| Accessibility | Keyboard operates Help, disclosures, search, article navigation and editor. Focus order is logical; modal focus/return and non-modal panel behavior are correct. Touch actions do not depend on hover. VoiceOver/TalkBack announce names, expansion and errors. |
| Layout | 320/360/390/768/1024/1440 CSS px, portrait/landscape, zoom/text enlargement, keyboard visible, light/graphite. No header clipping or overlay on required save controls; code/identifiers remain accessible. |
| Help failure | Search/API timeout, missing article, denied access, old revision and route-module failure yield readable recovery. Retry is bounded. No forced refresh/clear-storage and no help error boundary replaces the entire data-entry form. |
| Offline | Download scoped pack and language, disconnect, cold-open article/search/recovery guide. Scope and approved revision preserved; images/external SOPs honestly unavailable when not downloaded. Quota failure cannot evict unsent lab work. |
| Withdrawal/update | Publish/withdraw while another tab/device has old help. Show consistent revision, apply learned tombstones, retain traceability and label offline freshness. Test old app/content compatibility and rollback. |
| Book reconciliation | Operational book pages are linked/generated from approved help revisions or clearly distinct technical manuals. Broken links and duplicated divergent instructions fail release. |
| Desktop regression | Capture unchanged desktop header layout except agreed Help entry; run core reception→workbench→review/report journey and affected admin/equipment flows. Scientific and API contracts unchanged by help. |

## Representative staff scenarios

1. Reception officer reopens a project intake with missing location. Help distinguishes missing source from broken display and preserves the draft.
2. Technician has preparation awaiting verification. Help explains the actual condition without offering another completion toggle.
3. Technician records pH across a run, opens a spectrum/texture guide and returns to the same raw input and sample.
4. Manager reviews a submitted result and reads amendment guidance; no help action approves anything.
5. A phone is offline with pending work. Recovery guidance opens and does not tell staff to clear app/browser storage.
6. Lab manager edits a local contact note; another lab cannot read or publish it.
7. A translator updates a reviewed phrase after the English source changes; source hashes and review status prevent mixed-version publication.

## Evidence required

Record build SHA, help publication/revision, locale, role/lab, viewport/device and checks performed. Keep screenshots and API/integration assertions separate from editorial review. Initial articles remain drafts until the relevant lab/scientific reviewer confirms instructions. Release requires the agreed launch collection in all five languages and verified scope/work-preservation tests; do not claim a fully translated Help Centre while serving undisclosed fallback.
