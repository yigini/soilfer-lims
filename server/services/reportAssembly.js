/**
 * Report Assembly Service
 * Assembles a complete report payload from sample data, results, work items, and lab context.
 */
const prisma = require('../prisma');
const { normalizeUnit, interpretParameter, evaluateSoilProfile } = require('./interpretationService');

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

    // 3. Fetch lab manager for auto-signature
    let labManager = null;
    if (lab) {
        labManager = await prisma.user.findFirst({
            where: {
                labId: lab.id,
                role: 'LAB_MANAGER',
                isActive: true
            },
            select: { name: true, username: true, email: true }
        });
        // Fallback: try matching by lab code
        if (!labManager) {
            labManager = await prisma.user.findFirst({
                where: {
                    labId: lab.code,
                    role: 'LAB_MANAGER',
                    isActive: true
                },
                select: { name: true, username: true, email: true }
            });
        }
    }

    // 4. Parse metadata
    const metadata = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
    const fieldMeta = typeof sample.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : (sample.fieldMetadata || {});
    const receptionData = typeof sample.receptionData === 'string' ? JSON.parse(sample.receptionData) : (sample.receptionData || {});

    // 5. Extract client/farmer info for search keys
    const clientInfo = extractClientInfo(metadata, fieldMeta, receptionData, sample);

    // 6. Fetch all analyses and their default methodologies
    const analyses = await prisma.analysis.findMany();
    const analysisMap = new Map(analyses.map(a => [a.code, a]));

    // Fetch default methodologies for all analysis codes in results
    const resultParams = sample.results.map(r => r.param);
    let methodologies = [];
    try {
        methodologies = await prisma.methodology.findMany({
            where: {
                analysisCode: { in: resultParams },
                isDefault: true
            }
        });
    } catch (e) { /* methodologies table may be empty */ }
    const methodMap = new Map(methodologies.map(m => [m.analysisCode, m]));

    // 7. Group results by category and apply controlled units & agronomic interpretation
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
        const methodology = methodMap.get(result.param);
        const rawUnit = result.unit || analysis?.units || '';
        const interp = interpretParameter(result.param, result.value, rawUnit);

        groupedResults[category].items.push({
            param: result.param,
            name: analysis?.name || result.param,
            value: result.value,
            unit: interp.unit || rawUnit,
            method: methodology?.name || null,
            standard: methodology?.standard || null,
            interpretation: {
                rating: interp.rating,
                label: interp.label,
                advisory: interp.advisory
            },
            flags,
            isValid: result.isValid
        });
    }

    // 8. Fetch category names
    const categoryIds = [...new Set(Object.keys(groupedResults))];
    const categories = await prisma.analysisCategory.findMany({
        where: { id: { in: categoryIds } }
    });
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    for (const [catId, group] of Object.entries(groupedResults)) {
        group.categoryName = categoryMap.get(catId) || catId;
    }

    // 8b. Compute comprehensive multi-parameter soil diagnostics
    const soilDiagnostics = evaluateSoilProfile(sample.results.map(r => ({
        param: r.param,
        value: r.value,
        unit: r.unit || analysisMap.get(r.param)?.units
    })));

    // 9. Work item summary
    const workItemSummary = sample.workItems.map(wi => ({
        analysis: wi.analysis,
        status: wi.status,
        result: wi.result,
        completedAt: wi.completedAt,
        assignedTo: wi.assignedTo
    }));

    // 10. Lab branding
    let labBranding = {};
    if (lab?.branding) {
        labBranding = typeof lab.branding === 'string' ? JSON.parse(lab.branding) : lab.branding;
    }

    // 11. Build unique methodologies list for footnotes
    const usedMethods = [];
    const seenMethods = new Set();
    for (const m of methodologies) {
        const key = m.analysisCode;
        if (!seenMethods.has(key)) {
            seenMethods.add(key);
            const analysis = analysisMap.get(m.analysisCode);
            usedMethods.push({
                param: m.analysisCode,
                paramName: analysis?.name || m.analysisCode,
                method: m.name,
                standard: m.standard || null
            });
        }
    }

    // 12. Extract location data (merge receptionData + fieldMetadata)
    const locationData = extractLocationData(fieldMeta, receptionData, sample);

    // 13. Build report number
    const labCode = lab?.code || 'LAB';
    const year = new Date().getFullYear();
    // Version will be set by the controller, use placeholder
    const reportNumber = `RPT-${labCode}-${year}`;

    // 14. Build signedBy block
    const signedByName = labManager?.name || labManager?.username || user?.name || user?.username || 'Laboratory Manager';
    const signedBy = {
        name: signedByName,
        title: 'Laboratory Manager',
        date: new Date().toISOString()
    };

    // 15. Assemble the full report payload
    const reportContent = {
        // Report number (version appended by controller)
        reportNumber,
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
        // Holistic Multi-Parameter Soil Metrology & Diagnostics
        diagnostics: soilDiagnostics,
        // Methodologies footnotes
        methodologies: usedMethods,
        // Work Items
        workItems: workItemSummary,
        // Location data (merged and structured)
        locationData,
        // Field metadata (raw, for backward compat)
        fieldMetadata: fieldMeta,
        // Reception data (raw, for backward compat)
        receptionData,
        // Signature
        signedBy,
        // Generation metadata
        generated: {
            at: new Date().toISOString(),
            by: user?.username || 'system',
            byName: user?.name || user?.username || 'System'
        }
    };

    // 16. Extract denormalized search keys
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

function unwrapVal(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') {
        if ('value' in v) return unwrapVal(v.value);
        if ('label' in v) return unwrapVal(v.label);
        return null;
    }
    const str = String(v).trim();
    return str.length > 0 ? str : null;
}

/**
 * Extract client/farmer info from various metadata sources.
 */
function extractClientInfo(metadata, fieldMeta, receptionData, sample) {
    const info = {
        firstName: null,
        surname: null,
        fullName: null,
        phone: null,
        email: null,
        address: null,
        organization: null
    };

    const fm = fieldMeta || {};
    const rd = receptionData || {};
    const md = metadata || {};

    const rawName = unwrapVal(rd.clientName || rd.farmerName || sample?.clientName || fm.submitterName || fm.farmer_name || fm.farmerName || fm.client_name || fm.clientName);
    if (rawName) {
        const parts = rawName.split(/\s+/);
        info.firstName = parts[0] || null;
        info.surname = parts.slice(1).join(' ') || null;
        info.fullName = rawName;
    }

    info.phone = unwrapVal(rd.phone || rd.clientPhone || fm.contactPhone || fm.phone || fm.farmer_phone || fm.farmerPhone || md.phone);
    info.email = unwrapVal(rd.email || rd.clientEmail || fm.contactEmail || fm.email || fm.farmer_email || fm.farmerEmail || md.email);
    info.address = unwrapVal(rd.address || rd.clientAddress || fm.address || fm.farmer_address || md.address);
    info.organization = unwrapVal(rd.organization || rd.company || fm.organization || fm.submitterOrganization || fm.company || md.organization);

    return info;
}

/**
 * Extract and structure location data from multiple sources.
 */
function extractLocationData(fieldMeta, receptionData, sample) {
    const fm = fieldMeta || {};
    const rd = receptionData || {};

    return {
        gpsLat: unwrapVal(fm.latitude || fm.gps_lat || rd.gpsLat),
        gpsLng: unwrapVal(fm.longitude || fm.gps_lng || rd.gpsLng),
        altitude: unwrapVal(fm.altitude || rd.altitude),
        landUse: unwrapVal(fm.landUse || fm.land_use || rd.landUse),
        cropType: unwrapVal(fm.cropType || fm.crop_type || rd.cropType),
        soilDepth: unwrapVal(fm.soilDepth || fm.soil_depth || rd.depth || rd.soilDepth),
        soilTexture: unwrapVal(fm.soilTexture || fm.soil_texture || rd.soilTexture),
        district: unwrapVal(fm.district || rd.district),
        village: unwrapVal(fm.village || rd.village),
        region: unwrapVal(fm.region || fm.province || rd.region || rd.province),
        locationDescription: unwrapVal(fm.locationDescription || fm.location_description || rd.locationDescription),
        country: unwrapVal(sample?.countryName || sample?.country || fm.country)
    };
}

module.exports = { assembleReport, extractClientInfo, extractLocationData };
