"""Assemble exact generated additive DDL and guards once; no DB access."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
directory='20261013000200_control_charts'
target=root/'server/prisma/migrations'/directory/'migration.sql'
loader=root/'server/services/controlChartMigrationSource.js'
assert not target.exists() and not loader.exists()
schema=(Path(__file__).resolve().parent/'issue214-schema-ddl-direct-cli/schema-only.sql').read_text(encoding='utf-8')
guards='''-- Contract guards: no historical QC/policy row or evaluation is rewritten.
CREATE UNIQUE INDEX "ControlLimitSet_one_approved_series" ON "ControlLimitSet"("labId", "analysisCode", "methodologyId", "referenceMaterialId") WHERE "status"='APPROVED';

CREATE TRIGGER "control_limit_proposal_insert" BEFORE INSERT ON "ControlLimitProposal"
BEGIN
 SELECT CASE WHEN NEW."n"<2 OR NEW."sd"<=0 OR length(trim(NEW."reason"))=0 OR NOT json_valid(NEW."selectionSnapshot") OR NOT json_valid(NEW."policySnapshot")
  OR json_type(NEW."selectionSnapshot")<>'array'
  OR NEW."n" < coalesce(json_extract(NEW."policySnapshot", '$.values."qc.controlChartMinPoints"'),2147483647)
  OR NEW."n" <> (SELECT count(*) FROM json_each(NEW."selectionSnapshot") WHERE json_extract(value,'$.selected')=1)
  OR EXISTS(SELECT 1 FROM json_each(NEW."selectionSnapshot") WHERE json_extract(value,'$.selected')=0 AND length(trim(coalesce(json_extract(value,'$.exclusionReason'),'')))=0)
  OR NOT EXISTS(SELECT 1 FROM "Methodology" m WHERE m."id"=NEW."methodologyId" AND m."analysisCode"=NEW."analysisCode" AND (m."labId" IS NULL OR m."labId" IN (NEW."labId",(SELECT "code" FROM "Lab" WHERE "id"=NEW."labId"))))
  OR NOT EXISTS(SELECT 1 FROM "ReferenceMaterial" r WHERE r."id"=NEW."referenceMaterialId" AND r."labId"=NEW."labId")
  OR NOT EXISTS(SELECT 1 FROM "User" WHERE "username"=NEW."proposedBy")
 THEN RAISE(ABORT,'QC_CHART_PROPOSAL_INVALID') END;
END;

CREATE TRIGGER "control_limit_set_insert" BEFORE INSERT ON "ControlLimitSet"
BEGIN
 SELECT CASE WHEN NEW."status"<>'APPROVED' OR NEW."toDate" IS NOT NULL OR NOT EXISTS(
  SELECT 1 FROM "ControlLimitProposal" p WHERE p."id"=NEW."proposalId" AND p."labId"=NEW."labId" AND p."analysisCode"=NEW."analysisCode"
   AND p."methodologyId"=NEW."methodologyId" AND p."referenceMaterialId"=NEW."referenceMaterialId"
   AND p."mean"=NEW."mean" AND p."sd"=NEW."sd" AND p."n"=NEW."n" AND p."proposedBy"<>NEW."approvedBy")
  OR NOT EXISTS(SELECT 1 FROM "User" WHERE "username"=NEW."approvedBy")
 THEN RAISE(ABORT,'QC_CHART_APPROVAL_INVALID') END;
END;

CREATE TRIGGER "qc_review_obligation_insert" BEFORE INSERT ON "QcReviewObligation"
BEGIN
 SELECT CASE WHEN NOT json_valid(NEW."evidenceSnapshot") OR json_type(NEW."evidenceSnapshot")<>'array'
  OR NOT EXISTS(SELECT 1 FROM "QcEvaluation" e JOIN "Batch" b ON b."id"=e."batchId", json_each(e."details",'$.evaluation.controlCharts') c, json_each(c.value,'$.review') r
   WHERE e."id"=NEW."evaluationId" AND b."labId"=NEW."labId" AND r.value=NEW."rule")
 THEN RAISE(ABORT,'QC_CHART_REVIEW_INVALID') END;
END;

CREATE TRIGGER "qc_review_resolution_insert" BEFORE INSERT ON "QcReviewResolution"
BEGIN
 SELECT CASE WHEN NEW."outcome" NOT IN ('NO_ACTION','INVESTIGATE_NEW_LIMITS') OR length(trim(NEW."note"))=0
  OR NOT EXISTS(SELECT 1 FROM "User" WHERE "username"=NEW."resolvedBy")
 THEN RAISE(ABORT,'QC_CHART_RESOLUTION_INVALID') END;
END;

CREATE TRIGGER "control_limit_set_supersede_only" BEFORE UPDATE ON "ControlLimitSet"
BEGIN
 SELECT CASE WHEN OLD."status"<>'APPROVED' OR NEW."status"<>'SUPERSEDED' OR OLD."toDate" IS NOT NULL OR NEW."toDate" IS NULL
  OR NEW."toDate"<OLD."fromDate" OR NEW."id" IS NOT OLD."id" OR NEW."labId" IS NOT OLD."labId"
  OR NEW."analysisCode" IS NOT OLD."analysisCode" OR NEW."methodologyId" IS NOT OLD."methodologyId"
  OR NEW."referenceMaterialId" IS NOT OLD."referenceMaterialId" OR NEW."proposalId" IS NOT OLD."proposalId"
  OR NEW."mean" IS NOT OLD."mean" OR NEW."sd" IS NOT OLD."sd" OR NEW."n" IS NOT OLD."n"
  OR NEW."fromDate" IS NOT OLD."fromDate" OR NEW."approvedBy" IS NOT OLD."approvedBy"
 THEN RAISE(ABORT,'QC_CHART_LIMITS_IMMUTABLE') END;
END;
'''
for table in ['ControlLimitProposal','ControlLimitSet','QcReviewObligation','QcReviewResolution']:
 for operation in ['UPDATE','DELETE']:
  if table=='ControlLimitSet' and operation=='UPDATE':continue
  guards+=f'\nCREATE TRIGGER "{table}_{operation.lower()}_refused" BEFORE {operation} ON "{table}"\nBEGIN\n SELECT RAISE(ABORT,\'QC_CHART_EVIDENCE_IMMUTABLE\');\nEND;\n'
data=(schema+'\n'+guards).encode('utf-8')
target.parent.mkdir();target.write_bytes(data)
digest=hashlib.sha256(data).hexdigest()
loader.write_bytes(('''const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const DIRECTORY=''''+repr(directory)+''',SHA256=''''+repr(digest)+''';
function loadControlChartMigrationSource(){
 const root=path.resolve(__dirname,'..',fs.existsSync('/.dockerenv')?'.migrations-backup/214':'prisma/migrations',DIRECTORY);
 let bytes;try{bytes=fs.readFileSync(path.join(root,'migration.sql'));}catch(cause){throw Object.assign(new Error('Control chart DDL unavailable.',{cause}),{statusCode:409,code:'QC_CHART_SOURCE_MISMATCH'});}
 if(createHash('sha256').update(bytes).digest('hex')!==SHA256)throw Object.assign(new Error('Control chart DDL digest differs.'),{statusCode:409,code:'QC_CHART_SOURCE_MISMATCH'});
 const sql=bytes.toString('utf8'),boundary=sql.indexOf('-- Contract guards');
 if(boundary<0)throw Object.assign(new Error('Control chart guard boundary differs.'),{statusCode:409,code:'QC_CHART_SOURCE_MISMATCH'});
 return Object.freeze({sql,schemaSql:sql.slice(0,boundary),guardsSql:sql.slice(boundary),sha256:SHA256});
}
module.exports={loadControlChartMigrationSource};
''').encode('utf-8'))
print(json.dumps(dict(path=str(target),sha256=digest,existingTablesAltered=0,backfilledRows=0,databaseConnections=0)))
