# Audit4.4 — value feedback and override requests (#197), WIP

Branch `audit/4.4-value-validation` begins at mainad2244c9 after194 merged.
The cited missing `isInvalid` input and censor-limit/LOQ comparison remain.
[Scope pin6080149352](https://github.com/yigini/soilfer-lims/issues/197#issuecomment-6080149352)
defines the additive single-use approval table, immutable SQL state/context,
shared browser/server classification, nullable lab/method limits and a dilution
prompt only after an existing recorded source is eligible for191's command.

Initial WIP adds shared parsing/classification and the three nullable policy
keys. No default range is invented. Below-LOQ censor limits cannot be overridden;
numeric below-LOQ readings stay amber. Existing numeric-validation callers use
the actual shared classifier. The authorized queue now returns actual per-row
hard/policy/method rules; both numeric editors classify drafts immediately and
show translated ranges/LOQ/unit with the method LOQ quick key. The quick key
waits for BarcodeSafeInput's accepted change rather than bypassing wedge refusal.
Owned proof at1238f019: five suites/51 tests PASS, zero skips,10.546s.

[Cancellation pin6081599894](https://github.com/yigini/soilfer-lims/issues/197#issuecomment-6081599894)
adds explicit nullable cancelledBy/cancelledAt/cancelReason. Pending cancellation
keeps decision fields NULL; approved cancellation/consumption preserve original
approval byte for byte. The additive table, immutable SQL edges/context, active
cell partial uniqueness and dry-default preservation installer are implemented.
The unchanged historical DDL completeness check declares only this exact new
table as absent; its equality assertion and all prior gaps remain unchanged.
SQL/installer proof is running. Request/manager commands, transactional Result
consumption/read link, both approval UI roles and full validation remain.
No production migration/backfill count or full-suite pass is claimed.
199's future run-curve calibration maximum is deferred and will take precedence.
Production freeze and195 release hold remain; no production-host action.
