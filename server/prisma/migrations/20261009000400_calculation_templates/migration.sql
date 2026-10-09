-- Audit #199: additive tables only. No activation or analytical back-fill.
CREATE TABLE "CalcTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateKey" TEXT NOT NULL,
    "labId" TEXT,
    "parentTemplateId" TEXT,
    "version" INTEGER NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "methodologyId" TEXT,
    "variant" TEXT NOT NULL,
    "inputs" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "curve" TEXT,
    "formulaModule" TEXT NOT NULL,
    "outputUnit" TEXT NOT NULL,
    "outputDecimals" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "sourceCitation" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    CONSTRAINT "CalcTemplate_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalcTemplate_analysisCode_fkey" FOREIGN KEY ("analysisCode") REFERENCES "Analysis" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalcTemplate_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "Methodology" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalcTemplate_outputUnit_fkey" FOREIGN KEY ("outputUnit") REFERENCES "Unit" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalcTemplate_parentTemplateId_fkey" FOREIGN KEY ("parentTemplateId") REFERENCES "CalcTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CalcTemplateActivation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "methodologyId" TEXT,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "activatedBy" TEXT NOT NULL,
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "verifiedAgainstSop" BOOLEAN NOT NULL,
    "supersedesId" TEXT,
    CONSTRAINT "CalcTemplateActivation_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalcTemplateActivation_analysisCode_fkey" FOREIGN KEY ("analysisCode") REFERENCES "Analysis" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalcTemplateActivation_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "Methodology" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalcTemplateActivation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CalcTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalcTemplateActivation_activatedBy_fkey" FOREIGN KEY ("activatedBy") REFERENCES "User" ("username") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalcTemplateActivation_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "CalcTemplateActivation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CalibrationCurve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "batchAnalyteId" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "executedMethodRevision" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "supersedesId" TEXT,
    "slope" REAL,
    "intercept" REAL,
    "r" REAL,
    "rSquared" REAL,
    "levelCount" INTEGER NOT NULL,
    "minPointsApplied" INTEGER NOT NULL,
    "minRApplied" REAL NOT NULL,
    "thresholdSource" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    CONSTRAINT "CalibrationCurve_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalibrationCurve_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalibrationCurve_batchAnalyteId_fkey" FOREIGN KEY ("batchAnalyteId") REFERENCES "BatchAnalyte" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalibrationCurve_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "Methodology" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalibrationCurve_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CalcTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalibrationCurve_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User" ("username") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalibrationCurve_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "CalibrationCurve" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CalibrationPoint" (
    "curveId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "standardConcentration" REAL NOT NULL,
    "response" REAL NOT NULL,

    PRIMARY KEY ("curveId", "ordinal"),
    CONSTRAINT "CalibrationPoint_curveId_fkey" FOREIGN KEY ("curveId") REFERENCES "CalibrationCurve" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ResultCalculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resultId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "activationId" TEXT NOT NULL,
    "inputs" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "intermediate" TEXT NOT NULL,
    "output" REAL NOT NULL,
    "outputUnit" TEXT NOT NULL,
    "curveId" TEXT,
    "engineVersion" TEXT NOT NULL,
    "computedBy" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResultCalculation_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultCalculation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CalcTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultCalculation_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "CalcTemplateActivation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultCalculation_curveId_fkey" FOREIGN KEY ("curveId") REFERENCES "CalibrationCurve" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultCalculation_outputUnit_fkey" FOREIGN KEY ("outputUnit") REFERENCES "Unit" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultCalculation_computedBy_fkey" FOREIGN KEY ("computedBy") REFERENCES "User" ("username") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CalcTemplate_labId_analysisCode_methodologyId_idx" ON "CalcTemplate"("labId", "analysisCode", "methodologyId");
CREATE UNIQUE INDEX "CalcTemplate_templateKey_labId_version_key" ON "CalcTemplate"("templateKey", "labId", "version");
CREATE UNIQUE INDEX "CalcTemplateActivation_supersedesId_key" ON "CalcTemplateActivation"("supersedesId");
CREATE INDEX "CalcTemplateActivation_labId_analysisCode_methodologyId_idx" ON "CalcTemplateActivation"("labId", "analysisCode", "methodologyId");
CREATE UNIQUE INDEX "CalibrationCurve_supersedesId_key" ON "CalibrationCurve"("supersedesId");
CREATE INDEX "CalibrationCurve_labId_batchId_batchAnalyteId_idx" ON "CalibrationCurve"("labId", "batchId", "batchAnalyteId");
CREATE UNIQUE INDEX "CalibrationCurve_batchId_batchAnalyteId_revision_key" ON "CalibrationCurve"("batchId", "batchAnalyteId", "revision");
CREATE UNIQUE INDEX "ResultCalculation_resultId_key" ON "ResultCalculation"("resultId");

-- Contract guards
CREATE TRIGGER "CalcTemplate_insert_contract" BEFORE INSERT ON "CalcTemplate"
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('REFERENCE','LAB') OR NEW.version < 1
    OR length(trim(NEW.templateKey))=0 OR length(trim(NEW.variant))=0
    OR length(trim(NEW.createdBy))=0 OR length(trim(NEW.reason))=0
    OR NEW.outputDecimals < 0 OR NEW.outputDecimals > 100
    OR NEW.formulaModule NOT IN ('GRAVIMETRIC_MOISTURE','WALKLEY_BLACK','COLORIMETRIC_PHOSPHORUS','EXCHANGEABLE_CATION','CEC_TITRATION','KJELDAHL')
    OR (CASE WHEN json_valid(NEW.inputs) THEN json_type(NEW.inputs) <> 'array' ELSE 1 END)
    OR (CASE WHEN json_valid(NEW.parameters) THEN json_type(NEW.parameters) <> 'array' ELSE 1 END)
    OR (CASE WHEN json_valid(NEW.sourceCitation) THEN json_type(NEW.sourceCitation) <> 'object' ELSE 1 END)
    OR (NEW.curve IS NOT NULL AND (CASE WHEN json_valid(NEW.curve) THEN json_type(NEW.curve) <> 'object' ELSE 1 END))
    OR (NEW.formulaModule='COLORIMETRIC_PHOSPHORUS' AND NEW.curve IS NULL)
    OR (NEW.formulaModule<>'COLORIMETRIC_PHOSPHORUS' AND NEW.curve IS NOT NULL)
    OR (NEW.status='REFERENCE' AND (NEW.labId IS NOT NULL OR NEW.parentTemplateId IS NOT NULL OR NEW.version<>1))
    OR (NEW.status='LAB' AND (NEW.labId IS NULL OR NEW.parentTemplateId IS NULL OR NOT EXISTS (SELECT 1 FROM "User" WHERE username=NEW.createdBy)))
    THEN RAISE(ABORT,'CALC_TEMPLATE_INVALID') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM "CalcTemplate" WHERE templateKey=NEW.templateKey AND labId IS NEW.labId AND version=NEW.version)
    OR (NEW.status='LAB' AND NOT EXISTS (
      SELECT 1 FROM "CalcTemplate" parent WHERE parent.id=NEW.parentTemplateId AND (
        (NEW.version=1 AND parent.templateKey<>NEW.templateKey AND (parent.labId IS NULL OR parent.labId=NEW.labId)) OR
        (NEW.version=parent.version+1 AND parent.templateKey=NEW.templateKey AND parent.labId=NEW.labId
          AND parent.analysisCode=NEW.analysisCode AND parent.methodologyId IS NEW.methodologyId
          AND NOT EXISTS (SELECT 1 FROM "CalcTemplate" child WHERE child.templateKey=parent.templateKey AND child.labId=parent.labId AND child.version>parent.version))
      ))) THEN RAISE(ABORT,'CALC_TEMPLATE_VERSION_CHANGED') END;
  SELECT CASE WHEN NEW.methodologyId IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Methodology" method LEFT JOIN "Lab" lab ON lab.id=NEW.labId
    WHERE method.id=NEW.methodologyId AND method.analysisCode=NEW.analysisCode
      AND (method.labId IS NULL OR method.labId=lab.id OR method.labId=lab.code)
  ) THEN RAISE(ABORT,'CALC_TEMPLATE_SCOPE_INVALID') END;
END;

CREATE TRIGGER "CalcTemplateActivation_insert_contract" BEFORE INSERT ON "CalcTemplateActivation"
BEGIN
  SELECT CASE WHEN NEW.action NOT IN ('ACTIVATE','DEACTIVATE') OR NEW.verifiedAgainstSop<>1
    OR length(trim(NEW.reason))=0 OR NOT EXISTS (
      SELECT 1 FROM "CalcTemplate" template WHERE template.id=NEW.templateId AND template.version=NEW.templateVersion
        AND template.analysisCode=NEW.analysisCode AND (template.labId IS NULL OR template.labId=NEW.labId)
        AND (template.methodologyId IS NULL OR template.methodologyId IS NEW.methodologyId)
    ) THEN RAISE(ABORT,'CALC_ACTIVATION_INVALID') END;
  SELECT CASE WHEN NEW.methodologyId IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Methodology" method JOIN "Lab" lab ON lab.id=NEW.labId
      WHERE method.id=NEW.methodologyId AND method.analysisCode=NEW.analysisCode
        AND (method.labId IS NULL OR method.labId=lab.id OR method.labId=lab.code)
  ) THEN RAISE(ABORT,'CALC_TEMPLATE_SCOPE_INVALID') END;
  SELECT CASE WHEN (NEW.supersedesId IS NULL AND (NEW.action<>'ACTIVATE' OR EXISTS (
      SELECT 1 FROM "CalcTemplateActivation" WHERE labId=NEW.labId AND analysisCode=NEW.analysisCode AND methodologyId IS NEW.methodologyId)))
    OR (NEW.supersedesId IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "CalcTemplateActivation" parent WHERE parent.id=NEW.supersedesId AND parent.labId=NEW.labId
        AND parent.analysisCode=NEW.analysisCode AND parent.methodologyId IS NEW.methodologyId
        AND NOT EXISTS (SELECT 1 FROM "CalcTemplateActivation" child WHERE child.supersedesId=parent.id)
        AND (NEW.action='ACTIVATE' OR (parent.action='ACTIVATE' AND NEW.templateId=parent.templateId AND NEW.templateVersion=parent.templateVersion))
    )) THEN RAISE(ABORT,'CALC_TEMPLATE_VERSION_CHANGED') END;
END;

CREATE TRIGGER "CalibrationCurve_insert_contract" BEFORE INSERT ON "CalibrationCurve"
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('PASS','FAIL') OR NEW.revision<1 OR NEW.levelCount<1 OR NEW.minPointsApplied<1
    OR NEW.minRApplied<0 OR NEW.minRApplied>1
    OR (CASE WHEN json_valid(NEW.executedMethodRevision) THEN json_type(NEW.executedMethodRevision)<>'object' ELSE 1 END)
    OR (CASE WHEN json_valid(NEW.thresholdSource) THEN json_type(NEW.thresholdSource)<>'object' ELSE 1 END)
    OR (NEW.r IS NOT NULL AND (NEW.r < -1 OR NEW.r > 1)) OR (NEW.rSquared IS NOT NULL AND (NEW.rSquared<0 OR NEW.rSquared>1))
    OR (NEW.status='PASS' AND (NEW.slope IS NULL OR NEW.slope=0 OR NEW.intercept IS NULL OR NEW.r IS NULL OR NEW.rSquared IS NULL
      OR NEW.levelCount<NEW.minPointsApplied OR NEW.r<NEW.minRApplied))
    OR (NEW.revision>1 AND (NEW.reason IS NULL OR length(trim(NEW.reason))=0))
    THEN RAISE(ABORT,'CALIBRATION_CURVE_INVALID') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM "Batch" batch JOIN "BatchAnalyte" analyte ON analyte.batchId=batch.id
      JOIN "CalcTemplate" template ON template.id=NEW.templateId
    WHERE batch.id=NEW.batchId AND analyte.id=NEW.batchAnalyteId AND batch.labId=NEW.labId AND analyte.labId=NEW.labId
      AND batch.startedAt IS NOT NULL AND analyte.provenance='NATIVE' AND analyte.methodologyId=NEW.methodologyId
      AND template.version=NEW.templateVersion AND template.analysisCode=analyte.analysisCode AND template.curve IS NOT NULL
      AND (template.labId IS NULL OR template.labId=NEW.labId)
      AND json_extract(analyte.criteriaSnapshot,'$.methodRevision.id')=NEW.methodologyId
      AND json_extract(NEW.executedMethodRevision,'$.id')=NEW.methodologyId
      AND json_extract(analyte.criteriaSnapshot,'$.methodRevision.version')=json_extract(NEW.executedMethodRevision,'$.version')
  ) THEN RAISE(ABORT,'CALIBRATION_CURVE_CONTEXT_MISMATCH') END;
  SELECT CASE WHEN (NEW.revision=1 AND (NEW.supersedesId IS NOT NULL OR EXISTS (
      SELECT 1 FROM "CalibrationCurve" WHERE batchId=NEW.batchId AND batchAnalyteId=NEW.batchAnalyteId)))
    OR (NEW.revision>1 AND NOT EXISTS (
      SELECT 1 FROM "CalibrationCurve" parent WHERE parent.id=NEW.supersedesId AND parent.batchId=NEW.batchId
        AND parent.batchAnalyteId=NEW.batchAnalyteId AND parent.labId=NEW.labId AND NEW.revision=parent.revision+1
        AND parent.methodologyId=NEW.methodologyId AND parent.executedMethodRevision=NEW.executedMethodRevision
        AND NOT EXISTS (SELECT 1 FROM "CalibrationCurve" child WHERE child.supersedesId=parent.id)
    )) THEN RAISE(ABORT,'CALIBRATION_CURVE_VERSION_CHANGED') END;
END;

CREATE TRIGGER "CalibrationPoint_insert_contract" BEFORE INSERT ON "CalibrationPoint"
BEGIN
  SELECT CASE WHEN NEW.ordinal<1 OR NEW.standardConcentration<0 OR NOT EXISTS (
    SELECT 1 FROM "CalibrationCurve" curve WHERE curve.id=NEW.curveId
      AND NOT EXISTS (SELECT 1 FROM "CalibrationCurve" child WHERE child.supersedesId=curve.id)
      AND NOT EXISTS (SELECT 1 FROM "ResultCalculation" calculation WHERE calculation.curveId=curve.id)
  ) THEN RAISE(ABORT,'CALIBRATION_POINT_INVALID') END;
END;

CREATE TRIGGER "ResultCalculation_insert_contract" BEFORE INSERT ON "ResultCalculation"
BEGIN
  SELECT CASE WHEN length(trim(NEW.engineVersion))=0
    OR (CASE WHEN json_valid(NEW.inputs) THEN json_type(NEW.inputs)<>'object' ELSE 1 END)
    OR (CASE WHEN json_valid(NEW.parameters) THEN json_type(NEW.parameters)<>'array' ELSE 1 END)
    OR (CASE WHEN json_valid(NEW.intermediate) THEN json_type(NEW.intermediate)<>'object' ELSE 1 END)
    OR NOT EXISTS (
      SELECT 1 FROM "Result" result JOIN "Sample" sample ON sample.id=result.sampleId
        JOIN "Lab" lab ON lab.id=sample.assignedLab OR lab.code=sample.assignedLab
        JOIN "CalcTemplateActivation" activation ON activation.id=NEW.activationId
        JOIN "CalcTemplate" template ON template.id=NEW.templateId
      WHERE result.id=NEW.resultId AND result.numericValue IS NEW.output AND result.unit=NEW.outputUnit
        AND result.enteredBy=NEW.computedBy AND activation.labId=lab.id AND activation.action='ACTIVATE'
        AND activation.templateId=NEW.templateId AND activation.templateVersion=NEW.templateVersion
        AND activation.analysisCode=result.param AND activation.methodologyId IS result.methodologyId
        AND NOT EXISTS (SELECT 1 FROM "CalcTemplateActivation" child WHERE child.supersedesId=activation.id)
        AND template.version=NEW.templateVersion AND template.outputUnit=NEW.outputUnit AND template.parameters=NEW.parameters
        AND ((template.curve IS NULL AND NEW.curveId IS NULL) OR (template.curve IS NOT NULL AND EXISTS (
          SELECT 1 FROM "CalibrationCurve" curve JOIN "BatchAnalyte" analyte ON analyte.id=curve.batchAnalyteId
          WHERE curve.id=NEW.curveId AND curve.batchId=result.batchId AND curve.labId=lab.id
            AND curve.methodologyId=result.methodologyId AND analyte.analysisCode=result.param
            AND curve.templateId=NEW.templateId AND curve.templateVersion=NEW.templateVersion AND curve.status='PASS'
            AND NOT EXISTS (SELECT 1 FROM "CalibrationCurve" child WHERE child.supersedesId=curve.id)
        )))
    ) THEN RAISE(ABORT,'RESULT_CALCULATION_CONTEXT_MISMATCH') END;
END;

CREATE TRIGGER "CalcTemplate_update_immutable" BEFORE UPDATE ON "CalcTemplate"
BEGIN
  SELECT RAISE(ABORT,'CALC_TEMPLATE_IMMUTABLE');
END;
CREATE TRIGGER "CalcTemplate_delete_immutable" BEFORE DELETE ON "CalcTemplate"
BEGIN
  SELECT RAISE(ABORT,'CALC_TEMPLATE_IMMUTABLE');
END;
CREATE TRIGGER "CalcTemplateActivation_update_immutable" BEFORE UPDATE ON "CalcTemplateActivation"
BEGIN
  SELECT RAISE(ABORT,'CALC_ACTIVATION_IMMUTABLE');
END;
CREATE TRIGGER "CalcTemplateActivation_delete_immutable" BEFORE DELETE ON "CalcTemplateActivation"
BEGIN
  SELECT RAISE(ABORT,'CALC_ACTIVATION_IMMUTABLE');
END;
CREATE TRIGGER "CalibrationCurve_update_immutable" BEFORE UPDATE ON "CalibrationCurve"
BEGIN
  SELECT RAISE(ABORT,'CALIBRATION_CURVE_IMMUTABLE');
END;
CREATE TRIGGER "CalibrationCurve_delete_immutable" BEFORE DELETE ON "CalibrationCurve"
BEGIN
  SELECT RAISE(ABORT,'CALIBRATION_CURVE_IMMUTABLE');
END;
CREATE TRIGGER "CalibrationPoint_update_immutable" BEFORE UPDATE ON "CalibrationPoint"
BEGIN
  SELECT RAISE(ABORT,'CALIBRATION_POINT_IMMUTABLE');
END;
CREATE TRIGGER "CalibrationPoint_delete_immutable" BEFORE DELETE ON "CalibrationPoint"
BEGIN
  SELECT RAISE(ABORT,'CALIBRATION_POINT_IMMUTABLE');
END;
CREATE TRIGGER "ResultCalculation_update_immutable" BEFORE UPDATE ON "ResultCalculation"
BEGIN
  SELECT RAISE(ABORT,'RESULT_CALCULATION_IMMUTABLE');
END;
CREATE TRIGGER "ResultCalculation_delete_immutable" BEFORE DELETE ON "ResultCalculation"
BEGIN
  SELECT RAISE(ABORT,'RESULT_CALCULATION_IMMUTABLE');
END;
