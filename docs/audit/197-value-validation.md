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
the actual shared classifier. Request schema/commands, central transactional
consumption, row-rule resolution, both UI roles/locales and full validation
remain to implement. No current validation or migration/backfill pass claimed.
199's future run-curve calibration maximum is deferred and will take precedence.
Production freeze and195 release hold remain; no production-host action.
