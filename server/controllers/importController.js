const prisma = require('../prisma');

/**
 * Parses simple CSV string into headers and rows
 */
function parseCsv(csvText) {
    if (!csvText || typeof csvText !== 'string') return { headers: [], rows: [] };
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return { headers: [], rows: [] };

    // Simple CSV parser handling comma separation
    const parseLine = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(cur.trim());
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur.trim());
        return result;
    };

    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const rowObj = {};
        headers.forEach((h, idx) => {
            rowObj[h] = values[idx] !== undefined ? values[idx] : '';
        });
        rows.push(rowObj);
    }
    return { headers, rows };
}

/**
 * POST /api/import/preview
 * Previews CSV file and suggests mappings to catalogue, methods, and units
 */
exports.previewCsv = async (req, res) => {
    const { csvText } = req.body;
    if (!csvText) {
        return res.status(400).json({ error: 'csvText is required.' });
    }

    try {
        const { headers, rows } = parseCsv(csvText);
        if (headers.length === 0) {
            return res.status(400).json({ error: 'No valid CSV headers found.' });
        }

        const analyses = await prisma.analysis.findMany({ select: { code: true, name: true, unitCode: true } });
        const units = await prisma.unit.findMany({ select: { code: true, display: true } });
        const methodologies = await prisma.methodology.findMany({ select: { id: true, name: true, analysisCode: true, isDefault: true } });

        // Auto-suggest mappings
        const suggestedMappings = [];
        for (const h of headers) {
            const lowerH = h.toLowerCase();
            const matchedAnalysis = analyses.find(a =>
                a.code.toLowerCase() === lowerH ||
                a.name.toLowerCase() === lowerH ||
                lowerH.includes(a.code.toLowerCase())
            );

            let matchedMethod = null;
            let matchedUnit = null;

            if (matchedAnalysis) {
                matchedMethod = methodologies.find(m => m.analysisCode === matchedAnalysis.code && m.isDefault) ||
                                methodologies.find(m => m.analysisCode === matchedAnalysis.code);
                matchedUnit = units.find(u => u.code === matchedAnalysis.unitCode) ||
                              units.find(u => u.code.toLowerCase() === lowerH);
            }

            suggestedMappings.push({
                column: h,
                analysisCode: matchedAnalysis ? matchedAnalysis.code : '',
                methodologyId: matchedMethod ? matchedMethod.id : '',
                unitCode: matchedUnit ? matchedUnit.code : (matchedAnalysis?.unitCode || '')
            });
        }

        res.json({
            headers,
            previewRows: rows.slice(0, 10),
            totalRows: rows.length,
            suggestedMappings
        });
    } catch (error) {
        console.error('[previewCsv] Error:', error);
        res.status(500).json({ error: 'Failed to preview CSV' });
    }
};

/**
 * POST /api/import/execute
 * Strictly validates that EVERY mapped column has an analysis, a method, and a controlled unit.
 * Imports results with provenance: 'IMPORTED'.
 */
exports.executeImport = async (req, res) => {
    const { sampleIdColumn, labId, columnMappings, rows } = req.body;
    const user = req.user;

    if (!sampleIdColumn) {
        return res.status(400).json({ error: 'sampleIdColumn is required.' });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No data rows provided for import.' });
    }
    if (!Array.isArray(columnMappings) || columnMappings.length === 0) {
        return res.status(400).json({
            error: 'A CSV cannot be imported without every column mapped to an analysis, a method and a controlled unit.'
        });
    }

    // 1. Validate mandatory mapping for every column
    for (const mapping of columnMappings) {
        if (!mapping.column) {
            return res.status(400).json({ error: 'Each mapping must specify a column name.' });
        }
        if (!mapping.analysisCode || !mapping.methodologyId || !mapping.unitCode) {
            return res.status(400).json({
                error: `A CSV cannot be imported without every column mapped to an analysis, a method and a controlled unit. Column '${mapping.column}' is missing required mapping.`
            });
        }
    }

    try {
        // Verify that mapped analyses, methods, and units exist in the system
        const analysisCodes = [...new Set(columnMappings.map(m => m.analysisCode))];
        const methodIds = [...new Set(columnMappings.map(m => m.methodologyId))];
        const unitCodes = [...new Set(columnMappings.map(m => m.unitCode))];

        const existingAnalyses = await prisma.analysis.findMany({
            where: { code: { in: analysisCodes } },
            select: { code: true }
        });
        const existingAnalysisCodes = new Set(existingAnalyses.map(a => a.code));

        for (const code of analysisCodes) {
            if (!existingAnalysisCodes.has(code)) {
                return res.status(400).json({
                    error: `A CSV cannot be imported without every column mapped to an analysis, a method and a controlled unit. Analysis code '${code}' does not exist in catalogue.`
                });
            }
        }

        const existingUnits = await prisma.unit.findMany({
            where: { code: { in: unitCodes } },
            select: { code: true }
        });
        const existingUnitCodes = new Set(existingUnits.map(u => u.code));

        for (const uCode of unitCodes) {
            if (!existingUnitCodes.has(uCode)) {
                return res.status(400).json({
                    error: `A CSV cannot be imported without every column mapped to an analysis, a method and a controlled unit. Unit code '${uCode}' does not exist in controlled units.`
                });
            }
        }

        const existingMethods = await prisma.methodology.findMany({
            where: { id: { in: methodIds } },
            select: { id: true }
        });
        const existingMethodIds = new Set(existingMethods.map(m => m.id));

        for (const mId of methodIds) {
            if (!existingMethodIds.has(mId)) {
                // Check if it exists in MethodReference
                const ref = await prisma.methodReference.findUnique({ where: { id: mId } });
                if (!ref) {
                    return res.status(400).json({
                        error: `A CSV cannot be imported without every column mapped to an analysis, a method and a controlled unit. Methodology ID '${mId}' does not exist.`
                    });
                }
            }
        }

        // 2. Perform import
        const targetLabId = labId || user?.labId || 'LAB-DEFAULT';
        let importedSamplesCount = 0;
        let importedResultsCount = 0;
        const now = new Date();

        for (const row of rows) {
            const rawSampleId = row[sampleIdColumn];
            if (!rawSampleId) continue;

            const sampleCode = String(rawSampleId).trim();
            let sample = await prisma.sample.findFirst({
                where: { OR: [{ id: sampleCode }, { originalId: sampleCode }] }
            });

            if (!sample) {
                sample = await prisma.sample.create({
                    data: {
                        id: sampleCode,
                        originalId: sampleCode,
                        status: 'APPROVED',
                        labId: targetLabId,
                        assignedLab: targetLabId,
                        receptionData: JSON.stringify({
                            isLegacy: true,
                            importedAt: now,
                            importedBy: user?.username || 'SYSTEM'
                        })
                    }
                });
                importedSamplesCount++;
            }

            // Create imported results for each mapped column
            for (const map of columnMappings) {
                const cellVal = row[map.column];
                if (cellVal === undefined || cellVal === null || String(cellVal).trim() === '') continue;

                const strVal = String(cellVal).trim();
                const numVal = isNaN(Number(strVal)) ? null : Number(strVal);
                const resultId = `RES-IMP-${sample.id}-${map.analysisCode}-${Date.now()}-${Math.floor(Math.random()*1000)}`;

                await prisma.result.create({
                    data: {
                        id: resultId,
                        sampleId: sample.id,
                        param: map.analysisCode,
                        value: strVal,
                        numericValue: numVal,
                        unit: map.unitCode,
                        methodologyId: map.methodologyId,
                        provenance: 'IMPORTED',
                        isValid: true,
                        isCurrent: true,
                        enteredBy: user?.username || 'LEGACY_IMPORT',
                        analysedAt: now,
                        createdAt: now,
                        updatedAt: now
                    }
                });
                importedResultsCount++;
            }
        }

        // Audit Log
        await prisma.auditLog.create({
            data: {
                id: `audit-import-${Date.now()}`,
                entity: 'LEGACY_IMPORT',
                entityId: `IMPORT-${Date.now()}`,
                action: 'IMPORT_LEGACY_DATA',
                details: `Imported ${importedSamplesCount} historical samples and ${importedResultsCount} results with provenance IMPORTED`,
                performedBy: user?.username || 'system',
                timestamp: now
            }
        });

        res.json({
            success: true,
            message: `Successfully imported ${importedSamplesCount} samples and ${importedResultsCount} results.`,
            importedSamples: importedSamplesCount,
            importedResults: importedResultsCount
        });
    } catch (error) {
        console.error('[executeImport] Error:', error);
        res.status(500).json({ error: 'Failed to execute legacy import: ' + error.message });
    }
};

exports.parseCsv = parseCsv;
