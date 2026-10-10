# Held resolution design for the #191 release blocker

Source: Claudio's comment at 2026-10-10 18:40:49 UTC:
https://github.com/yigini/soilfer-lims/issues/191#issuecomment-6100903042

YY's actual review choice remains pending. This records design and ownership;
it does not record a human decision or authorize production changes.

If YY chooses "Link recorded accept", Claudio writes a separately reviewed,
additive forward fix between #190 and #191. It ties the existing ACCEPT
decision `dec-s02-p-acc` to `att-s02-p-2` through the guarded status-only
transitions RECORDED -> SUBMITTED -> ACCEPTED and adds an immutable
WORK_ATTEMPT event citing that decision. It must be dry-run first, idempotent
and have exactly one expected item. The published report stays unchanged.

The alternative "Reopen and amend" requires its own reviewed executable path;
deployed `283a8bb` cannot perform that reopen.

Claudio owns implementation. Pip integrates the audited fix, updates exact
application/source/PR pins and installer order, and takes a NEW fresh
production copy for the complete rehearsal. #191 dry-run must report zero
blocked WorkItems before apply. Its required gate and existing installer stay
unchanged. Retained failed proofs remain FAILED; production is untouched.
