# Audit 4.6 — raw calculations and run curves (#199), WIP

Branch `audit/4.6-calculation-templates` starts at merged main
`6093198e688c0ea1973f7109869e10c5fde1e5e1`. Dependency #190 is merged.
WorkItemDraft still stores final value/texture/checks at schema.prisma:330–354;
completion preview forwards these fields at workbenchController.js:1545–1572.
The Result writer has no calculation/raw-input authority. WorkAttempt.rawData
and calcVersion exist but remain historical, immutable evidence.

[Scope pin 6083098510](https://github.com/yigini/soilfer-lims/issues/199#issuecomment-6083098510)
resolves the issue body and earlier comments as follows:

- Add immutable CalcTemplate and CalcTemplateActivation version chains. Lab
  clone/edit/activate/deactivate commands require the new central
  MANAGE_CALC_TEMPLATES permission, laboratory scope, a reason and explicit
  SOP verification. Migration creates no activations.
- Shipped templates remain inactive REFERENCE records. Constants are versioned
  method parameters. No existing laboratory method changes automatically.
- Each Result, including each replicate in one WorkAttempt, receives its own
  immutable ResultCalculation, with exact template/activation, inputs,
  parameters, intermediate arithmetic, output, engine and optional curve
  revision. Do not write or replace WorkAttempt.rawData/calcVersion.
- One immutable CalibrationCurve chain belongs to a started native Batch and
  BatchAnalyte, bound to executed method revision and template version.
  CalibrationPoint rows retain every measured point. The server derives
  unweighted ordinary least squares with a free intercept, Pearson r and r².
  Distinct concentration levels determine the point count. Points are never
  excluded from an existing revision.
- Only an activated curve-declaring template requires calibration. The shipped
  Olsen and Bray-1 variants declare it; AAS/ICP accepts the instrument reading.
  Existing methods without activation keep their final-value path.
- Use existing qc.curveMinPoints and qc.curveMinR through the QcRule/policyService
  resolution order. Freeze applied limits and their source on each curve; do
  not re-grade previous curves after policy changes. Remove these two fields
  from the deferred set only when their actual authority is implemented.
- Missing/latest-FAIL curves block Result recording and the actual analyte
  completion/commit path with the pinned stable 409 codes. Failure cannot be
  overridden. A new reasoned revision applies only to subsequent Results.
- Shared browser/server calculation rejects required-input, version and rounded
  output mismatches. Review and audit expose the raw inputs, constants and curve.

The initial library covers moisture, Walkley–Black OC (1.30 and 1.33), Olsen P,
Bray-1 P, exchangeable Ca/Mg/K/Na, CEC distillation/titration and Kjeldahl N.
Mass is g, volume/titre mL, concentration mg/L and normality eq/L. Exact
arithmetic and output precision must be source-cited and tested before shipping.
The primary-source starting point is the
[FAO GLOSOLAN SOP catalogue](https://www.fao.org/global-soil-partnership/Scientific-and-technical-support/networks/the-glosolan/en).
It lists the corresponding moisture, carbon, nitrogen and phosphorus SOPs.
The PDF equations, versions and pages have not yet been verified; no formula
implementation or golden-example claim is made by this checkpoint.

[Follow-up #270](https://github.com/yigini/soilfer-lims/issues/270) tracks the
explicitly deferred Mehlich-3, CEC summation and hydrometer/pipette variants.
This moves their existing scope to an accountable issue; it adds no guessed
method, correction table or source-selection contract.

[Policy boundary question 6083198845](https://github.com/yigini/soilfer-lims/issues/199#issuecomment-6083198845)
asks Claude to pin one policyService resolver for the lab/analysis/method's
active template, defaulting to no activation. This is needed to honor YY's
original requirement that calculation variants come through policyService.
The immutable activation chain remains the proposed authority; no competing
registry setting or direct controller/writer variant selection is introduced.
The question was delivered directly to Claude's active LIMS Audit thread.

No implementation, schema or back-fill has run at this checkpoint. No
production-host action is authorized under the absolute demo freeze.
