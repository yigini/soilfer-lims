/**
 * Report Assembly Service
 * Assembles a complete report payload from sample data, results, work items, and lab context.
 */
const prisma = require('../prisma');

/**
 * Assemble a full report object for a given sample.
 * Returns a structured JSON payload ready for storage and rendering.
 */
async function assembleReport(sampleId, user) {
    // 1. Fetch sample with all related data
    const sample = await prisma.sample.findUnique({
        where: { id: sampleId },
        include: {
            results: true,
            workItems: {
                orderBy: { createdAt: 'asc' }
            },
            project: true
        }
    });

    if (!sample) throw new Error(`Sample ${sampleId} not found`);

    // 2. Fetch lab info
    let lab = null;
    const labId = sample.assignedLab || sample.labId;
    if (labId) {
        lab = await prisma.lab.findFirst({
            where: { OR: [{ id: labId }, { code: labId }] }
        });
    }

    // 3. Parse metadata
    const metadata = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
    const fieldMeta = typeof sample.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : (sample.fieldMetadata || {});
    const receptionData = typeof sample.receptionData === 'string' ? JSON.parse(sample.receptionData) : (sample.receptionData || {});

    // 4. Extract client/farmer info for search keys
    const clientInfo = extractClientInfo(metadata, fieldMeta, receptionData, sample);

    // 5. Group results by category
    const analyses = await prisma.analysis.findMany();
    const analysisMap = new Map(analyses.map(a => [a.code, a]));

    const groupedResults = {};
    for (const result of sample.results) {
        const analysis = analysisMap.get(result.param);
        const category = analysis?.categoryId || 'Other';
        if (!groupedResults[category]) {
            groupedResults[category] = {
                categoryName: category,
                items: []
            };
        }

        const flags = typeof result.flags === 'string' ? JSON.parse(result.flags) : (result.flags || []);

        groupedResults[category].items.push({
            param: result.param,
            name: analysis?.name || result.param,
            value: result.value,
            unit: analysis?.units || result.unit || '',
            flags,
            isValid: result.isValid
        });
    }

    // 6. Fetch category names
    const categoryIds = [...new Set(Object.keys(groupedResults))];
    const categories = await prisma.analysisCategory.findMany({
        where: { id: { in: categoryIds } }
    });
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    for (const [catId, group] of Object.entries(groupedResults)) {
        group.categoryName = categoryMap.get(catId) || catId;
    }

    // 7. Work item summary
    const workItemSummary = sample.workItems.map(wi => ({
        analysis: wi.analysis,
        status: wi.status,
        result: wi.result,
        completedAt: wi.completedAt,
        assignedTo: wi.assignedTo
    }));

    // 8. Lab branding
    let labBranding = {};
    if (lab?.branding) {
        labBranding = typeof lab.branding === 'string' ? JSON.parse(lab.branding) : lab.branding;
    }

    // 9. Assemble the full report payload
    const reportContent = {
        // Sample Info
        sample: {
            id: sample.id,
            originalId: sample.originalId,
            labId: sample.labId,
            status: sample.status,
            projectCode: sample.projectCode,
            countryName: sample.countryName,
            country: sample.country,
            receptionDate: sample.receptionDate,
            receivedBy: sample.receivedBy,
            acceptedBy: sample.acceptedBy,
            acceptedAt: sample.acceptedAt,
            approvedBy: sample.approvedBy,
            approvedAt: sample.approvedAt
        },
        // Client/Farmer Info
        client: clientInfo,
        // Project Info
        project: sample.project ? {
            code: sample.project.code,
            name: sample.project.name,
            client: sample.project.client
        } : null,
        // Lab Info
        lab: lab ? {
            id: lab.id,
            code: lab.code,
            name: lab.name,
            country: lab.country,
            address: lab.address,
            city: lab.city,
            phone: lab.phone,
            email: lab.email,
            website: lab.website
        } : null,
        labBranding,
        // Results (grouped by category)
        resultGroups: Object.values(groupedResults),
        // Work Items
        workItems: workItemSummary,
        // Field metadata (location, sampling info)
        fieldMetadata: fieldMeta,
        // Reception data
        receptionData,
        // Generation metadata
        generated: {
            at: new Date().toISOString(),
            by: user?.username || 'system',
            byName: user?.name || user?.username || 'System'
        }
    };

    // 10. Extract denormalized search keys
    const searchKeys = {
        firstName: clientInfo.firstName || null,
        surname: clientInfo.surname || null,
        phone: clientInfo.phone || null,
        phoneNorm: clientInfo.phone ? clientInfo.phone.replace(/\D/g, '') : null,
        projectCode: sample.projectCode || null,
        projectName: sample.project?.name || null,
        sampleLabId: sample.labId || null
    };

    return { content: reportContent, searchKeys };
}

/**
 * Extract client/farmer info from various metadata sources.
 */
function extractClientInfo(metadata, fieldMeta, receptionData, sample) {
    const info = {
        firstName: null,
        surname: null,
        fullName: null,
        phone: null
    };

    // Try reception data first (walk-in intake often has client info)
    if (receptionData.clientName || receptionData.farmerName) {
        const name = receptionData.clientName || receptionData.farmerName || '';
        const parts = name.trim().split(/\s+/);
        info.firstName = parts[0] || null;
        info.surname = parts.slice(1).join(' ') || null;
        info.fullName = name.trim();
    }

    // Then try sample.clientName
    if (!info.fullName && sample.clientName) {
        const parts = sample.clientName.trim().split(/\s+/);
        info.firstName = parts[0] || null;
        info.surname = parts.slice(1).join(' ') || null;
        info.fullName = sample.clientName.trim();
    }

    // Then try field metadata (Kobo submissions)
    if (!info.fullName && fieldMeta) {
        const farmerName = fieldMeta.farmer_name || fieldMeta.farmerName ||
            fieldMeta.client_name || fieldMeta.clientName || '';
        if (farmerName) {
            const parts = farmerName.trim().split(/\s+/);
            info.firstName = parts[0] || null;
            info.surname = parts.slice(1).join(' ') || null;
            info.fullName = farmerName.trim();
        }
    }

    // Phone
    info.phone = receptionData.phone || fieldMeta?.phone || fieldMeta?.farmer_phone || metadata?.phone || null;

    return info;
}

module.exports = { assembleReport, extractClientInfo };
