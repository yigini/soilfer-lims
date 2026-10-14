-- #209/6163271808: retain all existing revisions, lines and attempts unchanged.
ALTER TABLE "OrderLine" ADD COLUMN "workItemId" TEXT;
CREATE INDEX "OrderLine_workItemId_idx" ON "OrderLine"("workItemId");

-- Contract guards
CREATE TRIGGER "SampleOrderRevision_active_insert" BEFORE INSERT ON "SampleOrderRevision"
WHEN NEW."status"='ACTIVE' AND EXISTS(SELECT 1 FROM "SampleOrderRevision" WHERE "sampleId"=NEW."sampleId" AND "status"='ACTIVE')
BEGIN
 SELECT RAISE(ABORT,'ORDER_REVISION_ACTIVE_UNIQUE');
END;

CREATE TRIGGER "SampleOrderRevision_active_update" BEFORE UPDATE ON "SampleOrderRevision"
WHEN NEW."status"='ACTIVE' AND EXISTS(SELECT 1 FROM "SampleOrderRevision" WHERE "sampleId"=NEW."sampleId" AND "status"='ACTIVE' AND "id"<>OLD."id")
BEGIN
 SELECT RAISE(ABORT,'ORDER_REVISION_ACTIVE_UNIQUE');
END;

CREATE TRIGGER "OrderLine_workItem_insert" BEFORE INSERT ON "OrderLine"
WHEN NEW."workItemId" IS NOT NULL AND (NOT EXISTS(
 SELECT 1 FROM "WorkItem" w JOIN "SampleOrderRevision" r ON r."id"=NEW."revisionId"
 WHERE w."id"=NEW."workItemId" AND w."sampleId"=r."sampleId"
 AND (trim(w."analysis")=NEW."analysis" OR NEW."analysis"='TEXTURE' AND trim(w."analysis") IN ('TEXTURE','SOIL_PSD_TEXTURE','SOIL_TEXTURE','PSA','pSA','Particle Size Analysis'))
) OR EXISTS(SELECT 1 FROM "OrderLine" WHERE "revisionId"=NEW."revisionId" AND "workItemId"=NEW."workItemId"))
BEGIN
 SELECT RAISE(ABORT,'ORDER_LINE_WORKITEM_INVALID');
END;

CREATE TRIGGER "OrderLine_workItem_update" BEFORE UPDATE ON "OrderLine"
WHEN NEW."workItemId" IS NOT OLD."workItemId" OR (OLD."workItemId" IS NOT NULL AND
 (NEW."id" IS NOT OLD."id" OR NEW."revisionId" IS NOT OLD."revisionId" OR NEW."analysis" IS NOT OLD."analysis"
 OR NEW."methodologyId" IS NOT OLD."methodologyId" OR NEW."methodRevision" IS NOT OLD."methodRevision" OR NEW."predecessorLineId" IS NOT OLD."predecessorLineId"))
BEGIN
 SELECT RAISE(ABORT,'ORDER_LINE_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER "WorkAttempt_orderLine_insert" BEFORE INSERT ON "WorkAttempt"
WHEN NEW."orderLineId" IS NULL OR NOT EXISTS(
 SELECT 1 FROM "OrderLine" l JOIN "SampleOrderRevision" r ON r."id"=l."revisionId"
 JOIN "WorkItem" w ON w."id"=NEW."workItemId"
 WHERE l."id"=NEW."orderLineId" AND r."sampleId"=w."sampleId" AND r."status"='ACTIVE' AND l."status"='ACTIVE'
 AND (l."workItemId"=w."id" OR l."workItemId" IS NULL)
 AND (trim(l."analysis")=trim(w."analysis") OR trim(l."analysis") IN ('TEXTURE','SOIL_PSD_TEXTURE','SOIL_TEXTURE','PSA','pSA','Particle Size Analysis') AND trim(w."analysis") IN ('TEXTURE','SOIL_PSD_TEXTURE','SOIL_TEXTURE','PSA','pSA','Particle Size Analysis'))
 AND (SELECT count(*) FROM "SampleOrderRevision" WHERE "sampleId"=w."sampleId" AND "status"='ACTIVE')=1
 AND ((l."workItemId"=w."id" AND (SELECT count(*) FROM "OrderLine" WHERE "revisionId"=r."id" AND "status"='ACTIVE' AND "workItemId"=w."id")=1)
 OR (l."workItemId" IS NULL AND NOT EXISTS(SELECT 1 FROM "OrderLine" WHERE "revisionId"=r."id" AND "status"='ACTIVE' AND "workItemId"=w."id")
 AND (SELECT count(*) FROM "OrderLine" x WHERE x."revisionId"=r."id" AND x."status"='ACTIVE' AND x."workItemId" IS NULL
 AND (trim(x."analysis")=trim(w."analysis") OR trim(x."analysis") IN ('TEXTURE','SOIL_PSD_TEXTURE','SOIL_TEXTURE','PSA','pSA','Particle Size Analysis') AND trim(w."analysis") IN ('TEXTURE','SOIL_PSD_TEXTURE','SOIL_TEXTURE','PSA','pSA','Particle Size Analysis')))=1))
)
BEGIN
 SELECT RAISE(ABORT,'ORDER_LINE_REQUIRED');
END;
