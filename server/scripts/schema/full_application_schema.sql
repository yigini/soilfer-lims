-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT,
    "labId" TEXT,
    "language" TEXT,
    "themePreference" TEXT NOT NULL DEFAULT 'light',
    "countries" TEXT,
    "projects" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "folderSender" TEXT,
    "folderRecipient" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "isChat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "client" TEXT,
    "startDate" DATETIME,
    "deliveryDeadline" DATETIME,
    "status" TEXT NOT NULL,
    "projectType" TEXT NOT NULL DEFAULT 'OPEN_INTAKE',
    "expectedSampleCount" INTEGER DEFAULT 0,
    "priority" TEXT DEFAULT 'NORMAL',
    "defaultAnalysisBundle" TEXT,
    "labId" TEXT,
    "countries" TEXT,
    "assignedLabIds" TEXT,
    "templateId" TEXT DEFAULT 'GENERIC_OPEN_INTAKE',
    "templateVersion" TEXT DEFAULT '1.0.0',
    "policyConfig" TEXT,
    "programmeCode" TEXT,
    "parentProjectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalId" TEXT NOT NULL,
    "projectCode" TEXT,
    "projectId" TEXT,
    "countryName" TEXT,
    "country" TEXT,
    "assignedLab" TEXT,
    "labId" TEXT,
    "status" TEXT NOT NULL,
    "dryingStatus" TEXT,
    "preparationStatus" TEXT,
    "receptionDate" DATETIME,
    "receivedBy" TEXT,
    "depthTop" REAL,
    "depthBottom" REAL,
    "horizon" TEXT,
    "clientName" TEXT,
    "metadata" TEXT,
    "fieldMetadata" TEXT,
    "receptionData" TEXT,
    "requiredAnalyses" TEXT,
    "analysisGroupIds" TEXT,
    "history" TEXT,
    "rejectionReason" TEXT,
    "receivedMass" REAL,
    "massWarningAcknowledged" BOOLEAN DEFAULT false,
    "moistureOnArrival" TEXT,
    "foreignMaterial" TEXT,
    "intakePhotos" TEXT,
    "isResubmission" BOOLEAN DEFAULT false,
    "latitude" REAL,
    "longitude" REAL,
    "elevation" REAL,
    "positionalUncertaintyM" REAL,
    "locationSource" TEXT,
    "locationCapturedAt" DATETIME,
    "locationCapturedBy" TEXT,
    "compositeRadiusM" REAL,
    "depthTopCm" REAL,
    "depthBottomCm" REAL,
    "admin1" TEXT,
    "admin2" TEXT,
    "village" TEXT,
    "siteName" TEXT,
    "custodyHandoverAt" DATETIME,
    "custodyCarrierName" TEXT,
    "custodyTrackingNumber" TEXT,
    "custodySenderSignature" TEXT,
    "receivingOfficerId" TEXT,
    "receivingOfficerName" TEXT,
    "receivingOfficerSignature" TEXT,
    "matrix" TEXT NOT NULL DEFAULT 'SOIL',
    "plantPart" TEXT,
    "growthStage" TEXT,
    "acceptedBy" TEXT,
    "acceptedAt" DATETIME,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "lastSubmissionId" TEXT,
    "lastSubmissionType" TEXT,
    "lastSubmissionAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "consignmentId" TEXT,
    CONSTRAINT "Sample_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sample_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "Consignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "projectCode" TEXT,
    "submitterName" TEXT,
    "submitterOrg" TEXT,
    "submitterPhone" TEXT,
    "submitterEmail" TEXT,
    "deliveredBy" TEXT,
    "deliveredAt" DATETIME,
    "receivedBy" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryNoteRef" TEXT,
    "expectedCount" INTEGER NOT NULL DEFAULT 0,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "custodyHandoverAt" DATETIME,
    "custodyCarrierName" TEXT,
    "custodyTrackingNumber" TEXT,
    "custodySenderSignature" TEXT,
    "receivingOfficerId" TEXT,
    "receivingOfficerName" TEXT,
    "receivingOfficerSignature" TEXT,
    "notes" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "labId" TEXT,
    "assignedLab" TEXT,
    "analysis" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL,
    "assignedTo" TEXT,
    "assignedBy" TEXT,
    "assignedAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueDate" DATETIME,
    "result" TEXT,
    "methodologyId" TEXT,
    "equipmentId" TEXT,
    "completedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    "submissionId" TEXT,
    "submittedAt" DATETIME,
    "batchId" TEXT,
    "rackPosition" INTEGER,
    "reanalysisReason" TEXT,
    "reanalysisRequestedBy" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewDecision" TEXT,
    "waiveReason" TEXT,
    "history" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkItem_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkItem_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User" ("username") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkItem_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User" ("username") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkItem_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "Methodology" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkItemDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labId" TEXT,
    "analysis" TEXT NOT NULL,
    "value" TEXT,
    "values" TEXT,
    "checks" TEXT,
    "basis" TEXT DEFAULT 'AIR_DRY',
    "replicateNo" INTEGER NOT NULL DEFAULT 1,
    "instrumentId" TEXT,
    "methodologyId" TEXT,
    "notes" TEXT,
    "baseVersion" INTEGER NOT NULL DEFAULT 0,
    "draftVersion" INTEGER NOT NULL DEFAULT 1,
    "conflictValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkItemDraft_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT,
    "analysis" TEXT NOT NULL,
    "instrument" TEXT,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "qcResults" TEXT,
    "workItemIds" TEXT,
    "maxCapacity" INTEGER DEFAULT 40,
    "profile" TEXT,
    "disposition" TEXT,
    "history" TEXT
);

-- CreateTable
CREATE TABLE "BatchQcResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "expected" REAL,
    "measured" REAL,
    "value1" REAL,
    "value2" REAL,
    "recoveryPct" REAL,
    "rpd" REAL,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchQcResult_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "labId" TEXT,
    "assignedLab" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workItemIds" TEXT,
    "workItemCount" INTEGER NOT NULL DEFAULT 0,
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Submission_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User" ("username") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleId" TEXT,
    "labId" TEXT,
    "analysisCode" TEXT,
    "before" TEXT,
    "after" TEXT
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "location" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "capacity" INTEGER,
    "timezone" TEXT,
    "projectCode" TEXT,
    "branding" TEXT,
    "settings" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProficiencyRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "roundRef" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "assignedValue" REAL NOT NULL,
    "uncertainty" REAL,
    "labResult" REAL NOT NULL,
    "zScore" REAL,
    "outcome" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProficiencyRound_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectLab" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectCode" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectLab_projectCode_fkey" FOREIGN KEY ("projectCode") REFERENCES "Project" ("code") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectLab_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "grade" TEXT,
    "unitOfMeasure" TEXT NOT NULL,
    "defaultLocationId" TEXT,
    "storageConditions" TEXT,
    "hazardClass" TEXT,
    "sopLink" TEXT,
    "reorderPoint" REAL NOT NULL DEFAULT 0,
    "reorderQuantity" REAL NOT NULL DEFAULT 0,
    "preferredVendor" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryItemId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "receivedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" DATETIME,
    "initialQuantity" REAL NOT NULL,
    "currentQuantity" REAL NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "locationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "coaAttachment" TEXT,
    "preparedBy" TEXT,
    "concentration" TEXT,
    "traceabilityNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryLot_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryLot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationType" TEXT NOT NULL DEFAULT 'SHELF',
    "parentLocationId" TEXT,
    "temperatureRange" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "actionType" TEXT NOT NULL,
    "inventoryLotId" TEXT NOT NULL,
    "deltaQuantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "reasonCode" TEXT,
    "freeTextReason" TEXT,
    "sampleId" TEXT,
    "workItemId" TEXT,
    "analysisCode" TEXT,
    CONSTRAINT "InventoryTransaction_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "inventoryLotId" TEXT NOT NULL,
    "reservedQuantity" REAL NOT NULL,
    "reservedByUserId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'GENERAL',
    "workItemId" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryReservation_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MethodRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisCode" TEXT NOT NULL,
    "methodId" TEXT,
    "inventoryItemId" TEXT NOT NULL,
    "defaultConsumption" REAL,
    "unit" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "labId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MethodRequirement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "internalAssetTag" TEXT,
    "locationId" TEXT,
    "status" TEXT NOT NULL,
    "criticality" TEXT NOT NULL,
    "commissioningDate" DATETIME,
    "notes" TEXT,
    "qcLimits" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EquipmentQualification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "calibrationStatus" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "lastCalibrationDate" DATETIME,
    "nextCalibrationDueDate" DATETIME,
    "lastVerificationDate" DATETIME,
    "nextVerificationDueDate" DATETIME,
    "toleranceProfileId" TEXT,
    "lastUpdatedBy" TEXT,
    "lastUpdatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentQualification_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentScheduleRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "scheduleType" TEXT NOT NULL,
    "frequencyDays" INTEGER,
    "dueSoonDays" INTEGER NOT NULL DEFAULT 30,
    "responsibleRole" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "EquipmentScheduleRule_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "attachmentIds" TEXT,
    "outcome" TEXT,
    "requiresManagerSignoff" BOOLEAN NOT NULL DEFAULT false,
    "managerDecision" TEXT,
    "managerReason" TEXT,
    CONSTRAINT "EquipmentEvent_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentMethodEligibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "methodId" TEXT,
    "equipmentTypeRequired" TEXT,
    "eligibleEquipmentIds" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "WorkItemEquipmentUse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runId" TEXT,
    "notes" TEXT,
    "attachments" TEXT,
    CONSTRAINT "WorkItemEquipmentUse_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkItemEquipmentUse_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpectralData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT,
    "labId" TEXT,
    "workItemId" TEXT,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "modality" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "scanIp" TEXT,
    "uploadedBy" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "wavelengths" TEXT,
    "values" TEXT,
    "qcStatus" TEXT,
    "qcFlags" TEXT,
    "sourceFile" TEXT,
    "sourceFormat" TEXT,
    "sha256" TEXT,
    "parserVersion" TEXT DEFAULT '1.0.0',
    "quantity" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "axisUnit" TEXT NOT NULL DEFAULT 'WAVENUMBER_CM1',
    "axisDirection" TEXT NOT NULL DEFAULT 'UNORDERED',
    "region" TEXT,
    "isRaw" BOOLEAN NOT NULL DEFAULT true,
    "equipmentId" TEXT,
    "resolution" REAL,
    "coAddedScans" INTEGER,
    "accessory" TEXT,
    "backgroundRef" TEXT,
    "backgroundAt" DATETIME,
    "detector" TEXT,
    "beamsplitter" TEXT,
    "preparation" TEXT,
    "moistureState" TEXT,
    "windowMaterial" TEXT,
    "replicateNo" INTEGER NOT NULL DEFAULT 1,
    "ambientTemp" REAL,
    "ambientRh" REAL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "supersedes" TEXT,
    "supersededBy" TEXT,
    "supersededAt" DATETIME,
    "supersedeReason" TEXT,
    "scanType" TEXT DEFAULT 'SAMPLE',
    "status" TEXT DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewNotes" TEXT,
    CONSTRAINT "SpectralData_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SpectralData_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branding" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Language" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "translations" TEXT
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "titleCode" TEXT,
    "titleParams" TEXT,
    "messageCode" TEXT,
    "messageParams" TEXT,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "senderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KoboConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "labName" TEXT,
    "projectCode" TEXT,
    "koboServerUrl" TEXT NOT NULL DEFAULT 'https://kf.kobotoolbox.org',
    "formId" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "fieldMapping" TEXT,
    "lastSyncAt" DATETIME,
    "lastSubmissionId" TEXT,
    "syncIntervalMins" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "param" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" REAL,
    "rawInput" TEXT,
    "unit" TEXT,
    "flags" TEXT,
    "isValid" BOOLEAN,
    "censoring" TEXT DEFAULT 'NONE',
    "basis" TEXT DEFAULT 'AIR_DRY',
    "provenance" TEXT NOT NULL DEFAULT 'MEASURED',
    "methodologyId" TEXT,
    "replicateNo" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "supersededBy" TEXT,
    "enteredBy" TEXT,
    "analysedAt" DATETIME,
    "equipmentId" TEXT,
    "batchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Result_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unit" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "display" TEXT NOT NULL,
    "quantityKind" TEXT NOT NULL,
    "factorToBase" REAL NOT NULL DEFAULT 1.0,
    "synonyms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MethodReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authority" TEXT NOT NULL,
    "citation" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LabMethodDefault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnalysisCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "labId" TEXT
);

-- CreateTable
CREATE TABLE "Analysis" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "units" TEXT,
    "unitCode" TEXT,
    "qudtUnit" TEXT,
    "matrix" TEXT NOT NULL DEFAULT 'SOIL',
    "module" TEXT NOT NULL DEFAULT 'FERTILITY',
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "executionOrder" INTEGER DEFAULT 100,
    "prerequisites" TEXT,
    "status" TEXT,
    "validation" TEXT,
    "decimalPlaces" INTEGER DEFAULT 2,
    "lod" REAL,
    "loq" REAL,
    "uncertainty" REAL,
    "labId" TEXT,
    "methodLabel" TEXT,
    "methodDefinition" TEXT,
    "methodCitation" TEXT,
    "sampleMassRequired" REAL DEFAULT 10.0,
    "version" INTEGER DEFAULT 1,
    CONSTRAINT "Analysis_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AnalysisCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Analysis_unitCode_fkey" FOREIGN KEY ("unitCode") REFERENCES "Unit" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "uri" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnalysisGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "analyses" TEXT,
    "labId" TEXT
);

-- CreateTable
CREATE TABLE "Methodology" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standard" TEXT,
    "referenceId" TEXT,
    "qudtUnit" TEXT,
    "decimalPlaces" INTEGER,
    "lod" REAL,
    "loq" REAL,
    "uncertainty" REAL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "labId" TEXT,
    "version" INTEGER DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Methodology_analysisCode_fkey" FOREIGN KEY ("analysisCode") REFERENCES "Analysis" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Methodology_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "MethodReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationalGate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "labId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "labId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "firstName" TEXT,
    "surname" TEXT,
    "phone" TEXT,
    "phoneNorm" TEXT,
    "projectCode" TEXT,
    "projectName" TEXT,
    "sampleLabId" TEXT,
    "content" TEXT,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReportShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    CONSTRAINT "ReportShareLink_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportAccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "accessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "ReportAccessLog_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ReportShareLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'NSIS_CONSUMER',
    "capabilities" TEXT,
    "connectionId" TEXT,
    "countries" TEXT,
    "projects" TEXT,
    "labs" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SampleOrderRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "requestedBy" TEXT,
    "authorizedBy" TEXT,
    "authorizedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SampleOrderRevision_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revisionId" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "methodologyId" TEXT,
    "methodRevision" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "omissionReason" TEXT,
    "omissionAuthorizedBy" TEXT,
    "omissionAuthorizedAt" DATETIME,
    "predecessorLineId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderLine_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SampleOrderRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "executedMethodRevision" TEXT,
    "author" TEXT,
    "authorName" TEXT,
    "materialAliquot" TEXT,
    "instrumentId" TEXT,
    "qcBatchId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "evidenceHash" TEXT,
    "evidenceData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkAttempt_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkAttempt_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "workItemId" TEXT,
    "submissionItemId" TEXT,
    "attemptId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "evidenceVersion" INTEGER,
    "evidenceHash" TEXT,
    "reviewerId" TEXT NOT NULL,
    "reviewerName" TEXT,
    "authorization" TEXT,
    "policyVersion" TEXT DEFAULT 'v1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewDecision_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewDecision_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SampleAmendment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "affectedOrderLines" TEXT,
    "affectedResults" TEXT,
    "affectedReports" TEXT,
    "impactAssessment" TEXT,
    "authorizedBy" TEXT,
    "authorizedAt" DATETIME,
    "resolution" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SampleAmendment_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommandReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "targetResource" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outcome" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HelpArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "feature" TEXT NOT NULL DEFAULT 'core',
    "roles" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 2,
    "reviewOwner" TEXT NOT NULL DEFAULT 'Lab operations lead',
    "visibility" TEXT NOT NULL DEFAULT 'AUTHENTICATED',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HelpRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "success" TEXT NOT NULL,
    "caution" TEXT NOT NULL,
    "related" TEXT NOT NULL,
    "sourceLocale" TEXT NOT NULL DEFAULT 'en',
    "sourceHash" TEXT NOT NULL,
    "changeReason" TEXT,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HelpRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "HelpArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HelpLocaleRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revisionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "success" TEXT NOT NULL,
    "caution" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'TRANSLATION_REQUIRED',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HelpLocaleRevision_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "HelpRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HelpPublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "approvedLocales" TEXT NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewDue" DATETIME,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "HelpPublication_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "HelpArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HelpPublication_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "HelpRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HelpLabNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "noteText" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HelpLabNote_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "HelpArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HelpFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "revisionId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "useful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "category" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HelpFeedback_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "HelpArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HelpSupportConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "supportName" TEXT,
    "contactMethod" TEXT,
    "contactValue" TEXT,
    "instructions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LabLifecycleState" (
    "labId" TEXT NOT NULL PRIMARY KEY,
    "operationalStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "pauseReason" TEXT,
    "pausedAt" DATETIME,
    "pausedBy" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StaffInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "projects" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" DATETIME
);

-- CreateTable
CREATE TABLE "StaffRecoveryGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_originalId_key" ON "Sample"("originalId");

-- CreateIndex
CREATE INDEX "Sample_consignmentId_idx" ON "Sample"("consignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Consignment_code_key" ON "Consignment"("code");

-- CreateIndex
CREATE INDEX "Consignment_labId_idx" ON "Consignment"("labId");

-- CreateIndex
CREATE INDEX "Consignment_projectCode_idx" ON "Consignment"("projectCode");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemDraft_workItemId_key" ON "WorkItemDraft"("workItemId");

-- CreateIndex
CREATE INDEX "WorkItemDraft_userId_labId_idx" ON "WorkItemDraft"("userId", "labId");

-- CreateIndex
CREATE INDEX "WorkItemDraft_sampleId_analysis_idx" ON "WorkItemDraft"("sampleId", "analysis");

-- CreateIndex
CREATE INDEX "BatchQcResult_batchId_idx" ON "BatchQcResult"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_code_key" ON "Lab"("code");

-- CreateIndex
CREATE INDEX "ProficiencyRound_labId_analysisCode_idx" ON "ProficiencyRound"("labId", "analysisCode");

-- CreateIndex
CREATE INDEX "ProficiencyRound_date_idx" ON "ProficiencyRound"("date");

-- CreateIndex
CREATE INDEX "ProjectLab_projectCode_idx" ON "ProjectLab"("projectCode");

-- CreateIndex
CREATE INDEX "ProjectLab_labId_idx" ON "ProjectLab"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLab_projectCode_labId_key" ON "ProjectLab"("projectCode", "labId");

-- CreateIndex
CREATE INDEX "InventoryItem_labId_idx" ON "InventoryItem"("labId");

-- CreateIndex
CREATE INDEX "InventoryItem_itemType_idx" ON "InventoryItem"("itemType");

-- CreateIndex
CREATE INDEX "InventoryLot_inventoryItemId_idx" ON "InventoryLot"("inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryLot_labId_idx" ON "InventoryLot"("labId");

-- CreateIndex
CREATE INDEX "InventoryLot_status_idx" ON "InventoryLot"("status");

-- CreateIndex
CREATE INDEX "InventoryLot_expiryDate_idx" ON "InventoryLot"("expiryDate");

-- CreateIndex
CREATE INDEX "InventoryLocation_labId_idx" ON "InventoryLocation"("labId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_inventoryLotId_idx" ON "InventoryTransaction"("inventoryLotId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_labId_idx" ON "InventoryTransaction"("labId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_timestamp_idx" ON "InventoryTransaction"("timestamp");

-- CreateIndex
CREATE INDEX "InventoryTransaction_actionType_idx" ON "InventoryTransaction"("actionType");

-- CreateIndex
CREATE INDEX "InventoryReservation_inventoryLotId_idx" ON "InventoryReservation"("inventoryLotId");

-- CreateIndex
CREATE INDEX "InventoryReservation_labId_idx" ON "InventoryReservation"("labId");

-- CreateIndex
CREATE INDEX "MethodRequirement_analysisCode_idx" ON "MethodRequirement"("analysisCode");

-- CreateIndex
CREATE INDEX "MethodRequirement_inventoryItemId_idx" ON "MethodRequirement"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentQualification_equipmentId_key" ON "EquipmentQualification"("equipmentId");

-- CreateIndex
CREATE INDEX "SpectralData_labId_isCurrent_idx" ON "SpectralData"("labId", "isCurrent");

-- CreateIndex
CREATE INDEX "SpectralData_sampleId_isCurrent_idx" ON "SpectralData"("sampleId", "isCurrent");

-- CreateIndex
CREATE INDEX "SpectralData_workItemId_isCurrent_idx" ON "SpectralData"("workItemId", "isCurrent");

-- CreateIndex
CREATE INDEX "SpectralData_sha256_idx" ON "SpectralData"("sha256");

-- CreateIndex
CREATE INDEX "SpectralData_equipmentId_idx" ON "SpectralData"("equipmentId");

-- CreateIndex
CREATE INDEX "SpectralData_equipmentId_scanType_idx" ON "SpectralData"("equipmentId", "scanType");

-- CreateIndex
CREATE UNIQUE INDEX "KoboConfig_labId_projectCode_key" ON "KoboConfig"("labId", "projectCode");

-- CreateIndex
CREATE INDEX "Result_sampleId_param_isCurrent_idx" ON "Result"("sampleId", "param", "isCurrent");

-- CreateIndex
CREATE INDEX "Result_batchId_idx" ON "Result"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "LabMethodDefault_labId_analysisCode_key" ON "LabMethodDefault"("labId", "analysisCode");

-- CreateIndex
CREATE INDEX "ExternalMapping_entityType_entityKey_idx" ON "ExternalMapping"("entityType", "entityKey");

-- CreateIndex
CREATE INDEX "ExternalMapping_scheme_code_idx" ON "ExternalMapping"("scheme", "code");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalGate_code_labId_key" ON "OperationalGate"("code", "labId");

-- CreateIndex
CREATE INDEX "Report_sampleId_idx" ON "Report"("sampleId");

-- CreateIndex
CREATE INDEX "Report_labId_idx" ON "Report"("labId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_projectCode_idx" ON "Report"("projectCode");

-- CreateIndex
CREATE INDEX "Report_sampleLabId_idx" ON "Report"("sampleLabId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_sampleId_version_key" ON "Report"("sampleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ReportShareLink_tokenHash_key" ON "ReportShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ReportShareLink_reportId_idx" ON "ReportShareLink"("reportId");

-- CreateIndex
CREATE INDEX "ReportAccessLog_linkId_idx" ON "ReportAccessLog"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "SampleOrderRevision_sampleId_idx" ON "SampleOrderRevision"("sampleId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleOrderRevision_sampleId_version_key" ON "SampleOrderRevision"("sampleId", "version");

-- CreateIndex
CREATE INDEX "OrderLine_revisionId_idx" ON "OrderLine"("revisionId");

-- CreateIndex
CREATE INDEX "OrderLine_analysis_idx" ON "OrderLine"("analysis");

-- CreateIndex
CREATE INDEX "WorkAttempt_workItemId_idx" ON "WorkAttempt"("workItemId");

-- CreateIndex
CREATE INDEX "WorkAttempt_orderLineId_idx" ON "WorkAttempt"("orderLineId");

-- CreateIndex
CREATE INDEX "ReviewDecision_sampleId_idx" ON "ReviewDecision"("sampleId");

-- CreateIndex
CREATE INDEX "ReviewDecision_workItemId_idx" ON "ReviewDecision"("workItemId");

-- CreateIndex
CREATE INDEX "SampleAmendment_sampleId_idx" ON "SampleAmendment"("sampleId");

-- CreateIndex
CREATE UNIQUE INDEX "CommandReceipt_idempotencyKey_key" ON "CommandReceipt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CommandReceipt_idempotencyKey_idx" ON "CommandReceipt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CommandReceipt_actor_idx" ON "CommandReceipt"("actor");

-- CreateIndex
CREATE INDEX "HelpArticle_category_idx" ON "HelpArticle"("category");

-- CreateIndex
CREATE INDEX "HelpArticle_visibility_idx" ON "HelpArticle"("visibility");

-- CreateIndex
CREATE INDEX "HelpRevision_articleId_idx" ON "HelpRevision"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "HelpRevision_articleId_revisionNumber_key" ON "HelpRevision"("articleId", "revisionNumber");

-- CreateIndex
CREATE INDEX "HelpLocaleRevision_locale_idx" ON "HelpLocaleRevision"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "HelpLocaleRevision_revisionId_locale_key" ON "HelpLocaleRevision"("revisionId", "locale");

-- CreateIndex
CREATE INDEX "HelpPublication_articleId_isCurrent_idx" ON "HelpPublication"("articleId", "isCurrent");

-- CreateIndex
CREATE INDEX "HelpLabNote_labId_idx" ON "HelpLabNote"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "HelpLabNote_articleId_labId_key" ON "HelpLabNote"("articleId", "labId");

-- CreateIndex
CREATE INDEX "HelpFeedback_articleId_idx" ON "HelpFeedback"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "HelpSupportConfig_labId_key" ON "HelpSupportConfig"("labId");

-- CreateIndex
CREATE INDEX "HelpSupportConfig_labId_idx" ON "HelpSupportConfig"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRecoveryGrant_tokenHash_key" ON "StaffRecoveryGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiKey_connectionId_idx" ON "ApiKey"("connectionId");

-- CreateTable
CREATE TABLE "_exchange_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "client_code" TEXT,
    "organization" TEXT,
    "contact_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "countries" TEXT,
    "projects" TEXT,
    "labs" TEXT,
    "auth_version" INTEGER NOT NULL DEFAULT 1,
    "rate_limit_per_min" INTEGER DEFAULT 120,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_exchange_connection_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connection_id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "key_status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" DATETIME
);

-- CreateIndex
CREATE INDEX "idx_exchange_conn_keys_conn" ON "_exchange_connection_keys"("connection_id");
CREATE INDEX "idx_exchange_conn_keys_key" ON "_exchange_connection_keys"("api_key_id");
