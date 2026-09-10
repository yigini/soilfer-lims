Please prioritize the user's live Help problem in LIMSI / LIMS Dev, working folder C:\Users\yigin\Documents\soilfer-lims. They report that the Help button says "No specific guide for this page." I independently confirmed the cause with read-only production checks. Finish the content rollout as part of the already-authorized Help implementation and deployment; do not treat the visible button as a completed Help feature.

Verified on production, 10 September 2026:
- Running image: soilfer-lims:v3.4.2-1b7a0f0.
- HelpArticle count: 27.
- Current HelpPublication count: 0.
- English: 27 EDITORIAL_DRAFT locale records.
- es, es-419, fr, pt: 27 TRANSLATION_REQUIRED records each.
- Public GET /api/help/topics?locale=en succeeds but every category has articleCount:0.
- GET /api/help/context?route=%2Flogin&locale=en succeeds with articles:[].
- The repository route registry contains 42 mappings; every referenced article ID exists in the 27-article collection. /workbench, /reception, /samples/:id and /admin/labs already have mappings.
- execute_production_release.sh explicitly requires current publications to equal zero, then calls the release complete. This proves draft containment only. It cannot be the acceptance condition for launched reader content.
- Context readers correctly require a current publication. Therefore all ordinary readers get zero guides. The generic "No specific guide" label incorrectly suggests missing page mapping.

This is not a request to bypass publication safeguards or expose drafts. It is a request to complete the actual usable Help feature, including content.

1. Complete and publish verified application guidance
Review the existing articles against the currently deployed controls and enabled capabilities, correct inaccurate instructions, and complete their five-language versions. Product navigation and how-to guidance is part of the already-authorized implementation; it should not all be held behind an invented requirement for scientific sign-off. Record the actual review provenance honestly. Do not claim a human scientist or lab manager reviewed text when they did not, and do not blindly mark all drafts APPROVED just to populate the panel. Separate genuine method/SOP decisions requiring a lab owner from ordinary application guidance, and avoid unsupported scientific instructions. Finish and release validated application guides through an auditable content-publication process. If a specific method statement needs an actual domain decision, identify that exact statement and keep the affected item pending while the rest of Help remains useful.

Publish the reviewed content as an intentional versioned release, with a manifest of article IDs, source revisions/hashes, approved languages, scope and real review provenance. Preserve history and user edits. Seeding should remain idempotent and draft-only; publication should be an explicit, auditable release step rather than an accidental seed side effect. Do not leave the technician/intake/manager journeys empty after calling the task done.

2. Make multilingual review and publication usable
AdminHelpEditor still hardcodes locales:['en'], locale:'en' and approvedLocales:['en'] in its review, approve and publish handlers. Give the editor a functioning locale selector and locale-specific content/status workflow. Support reviewed multi-article release selection with a preview of exactly which article revisions and languages will be published, to avoid repetitive manual work without hiding review decisions. Do not invent translation approval.

Before enabling publications, fix the common locale resolver. In helpContentService getArticleById (around lines 247-250), getContextHelp (around 516-519) and related reader/search/pack paths, activeContent uses targetLocaleRev even when it is unapproved, and approvedLocales from the current publication is not honored. A fallback notice must not accompany unapproved translated bytes. Normal readers may receive only locales included in the publication and actually approved; if allowed, use the approved source language with a truthful fallback label. Preview remains an explicit authorized editor action. Use one consistent policy across article, context, list, search and offline pack.

3. Correct the empty/error experience
Return safe structured availability information that distinguishes no matching page guide, mapped guidance not yet published, no authorized content, unavailable translation, missing offline pack and request failure. Do not disclose restricted article titles/counts to unauthorized users. Normal users should see a clear explanation and useful authorized published general help/support links. Authorized editors should get a direct link to the relevant draft/review queue and a visible "content not published" explanation. A network error must not masquerade as "no specific guide." Do not silently add preview=true for ordinary users.

4. Verify the result on the actual live journeys
Use isolated fixtures for mutation tests, then read-only production smoke checks after release:
- Technician: workbench page recommendations, selected task blockers, opening a recommended article and full guide.
- Reception: reception and intake guidance.
- Manager: dashboard, sample details, review/report guidance.
- Admin: configuration guidance and content management.
- Public login: only the intentionally public guides.
- Help Centre, FAQ, topics, related links, search, all five languages, and offline pack refresh after publication.
Check actual guide titles, nonempty steps, permitted locales and correct links. HTTP 200 and categories with zero counts do not satisfy content availability. Capture actual React evidence, not the mockup.

5. Finish the authorized release and report clearly
Update the release checks to distinguish safe draft seeding from successful approved-content rollout. The published reader collection must match the release manifest and route coverage. Push the corrected source and non-sensitive release assets to GitHub, deploy through the established backed-up process, and update issue #92 to show content availability accurately. Keep lab data, result states and pending offline work untouched.
Report the exact live code revision, number of published guides per language, which representative pages were verified, and any precise remaining content review. Do not call the Help Centre ready while every page returns an empty list. Continue without another generic deployment-permission question.

Separate housekeeping discovered during this review: the untracked production release script contains a hardcoded authentication secret. Do not commit or repeat that value in chat/logs. Use the established protected deployment configuration, clean the generated script, and assess whether the actual exposure requires coordinated rotation while accounting for active sessions. This does not justify publishing any secrets or changing lab records.

Please acknowledge the root cause in simple English and proceed: "The Help framework was deployed, but the guides were left unpublished. I am completing the content release and checking that the right guides appear on each page." Keep updates friendly and concrete.

End of live Help content follow-up.


Your chat still shows an external curl to the server IP/port waiting. The public HTTPS /api/health endpoint responded successfully during this review. Use bounded connection/total timeouts for health probes and distinguish an inaccessible direct port from the health of the public HTTPS application; do not leave that diagnostic blocking this fix.