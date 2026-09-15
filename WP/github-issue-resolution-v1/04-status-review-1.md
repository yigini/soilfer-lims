# Status review 1 — 15 September 2026

Independent checks: HEAD bdb6b9c44677917dfa9f7843a71aee65d0e5b9f9; CI 34928283354 success; SSH observed healthy production image soilfer-lims:v3.5.8-bdb6b9c. #109 closed with a resolution comment; #108 started, other six issues remain open. No claim of independently replaying the profile UI or checking public asset hashes in this status pass.

Antigravity is paused asking for review of its #108 plan. The rendered plan was read through the app. Ordinary implementation/deployment remain authorized; no additional approval is needed to proceed within the packet after the following corrections.

## Calibration plan corrections

- Do not introduce a universal 30-day DUE_SOON threshold or mark absent schedule data OK. Reuse configured instrument policy and distinguish failure/rejection, overdue and not configured states.
- Recompute qualification from applicable event chronology/disposition; do not blindly invalidate current qualification when an old event is rejected. Test historical rejection/backdated failure after newer accepted calibration, and rejection of the current event. Explain any conservative hold needing review.
- Never change a DECOMMISSIONED instrument to merely OUT_OF_SERVICE on failure. Preserve unrelated restrictions.
- Validate performed/due dates, date-only time-zone semantics and explicit event/outcome combinations. Preserve existing notes and recorded timestamps. No automatic reclassification of maintenance events based on free text.
- Test repeat-submit/idempotency, actual modal save through list/detail/Maintenance and reload, authorized event reads/dispositions and server-side eligibility. Keep historical mismatch correction separately reviewed and auditable.
- Use an actual current pre-release data baseline, not an invariant permanently fixed to 36,870.

## Small #109 follow-up

LabManagement.handleSaveSettings catches Promise.all(fetchWorkspace, fetchLabs), but both helpers consume their own errors. Its savedRefreshFailed branch therefore cannot detect those failures. Return explicit outcomes or propagate an opt-in refresh error; verify save-success plus refresh-failure messaging. No broad refactor needed.

The issue comment cites API tests/build/health, but not the required real profile UI timezone-only/zero/reload check. Supply that evidence; do not claim build implies lint. Correct remaining issue/evidence status honestly.

## Communication status

Update, 15 September 2026 at 06:38 Europe/Rome: user explicitly said “please go ahead”. The continuation message was successfully delivered in LIMSI / LIMS Dev; Antigravity visibly read this review file and resumed Working. The earlier unsuccessful delivery below is historical. This confirms receipt, not completion of corrections.

A continuation/review message was prepared for UI delivery but was NOT sent. The composer contents changed during interaction and did not match the prepared message; input was stopped to avoid sending unrelated text. This file is available in the shared workspace, but receipt by Antigravity is not confirmed. No issue was reopened or changed in this check.
