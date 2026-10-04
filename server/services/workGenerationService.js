'use strict';
const prisma=require('../prisma');
const workflow=require('../workflowContract');
const COMPOUND_ANALYSIS_EXPANSION = {
    'exchangeableBases': ['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA']
};

const TEXTURE_ALIASES = new Set([
    'TEXTURE',
    'SOIL_PSD_TEXTURE',
    'SOIL_TEXTURE',
    'PSA',
    'pSA',
    'Particle Size Analysis'
]);

function normalizeAnalysisCodes(codes) {
    if (!Array.isArray(codes)) return [];
    const normalized = [];
    let hasTexture = false;
    for (const raw of codes) {
        if (!raw || typeof raw !== 'string') continue;
        const trimmed = raw.trim();
        if (TEXTURE_ALIASES.has(trimmed)) {
            if (!hasTexture) {
                normalized.push('TEXTURE');
                hasTexture = true;
            }
        } else if (COMPOUND_ANALYSIS_EXPANSION[trimmed]) {
            normalized.push(...COMPOUND_ANALYSIS_EXPANSION[trimmed]);
        } else {
            normalized.push(trimmed);
        }
    }
    const unique = [...new Set(normalized)];
    if (hasTexture) {
        return unique.filter(c => !['SAND', 'SILT', 'CLAY'].includes(c) || c === 'TEXTURE');
    }
    return unique;
}


async function resolveMethods(codes,sample,existing,db) {
 const selections=await require('./methodResolution').resolveDefaultSelections(codes.filter(c=>!existing.includes(c)),sample.assignedLab||sample.labId,db);
 const result=new Map();
 for(const [code,selection] of selections) {if(selection.error) throw new Error(selection.error);result.set(code,selection.method?.id||null);}
 return result;
}
async function generateWorkItemsForSample(sample, db = prisma, {strict=false} = {}) {
    const { id, labId } = sample;
    const requiredAnalyses = typeof sample.requiredAnalyses === 'string' ? JSON.parse(sample.requiredAnalyses) : (sample.requiredAnalyses || []);
    const workItems = [];
    const expandedCodes = normalizeAnalysisCodes(requiredAnalyses);
    const alreadyCreated = await db.workItem.findMany({ where: { sampleId: String(id) }, select: { analysis: true } });
    const defaultMethods = await resolveMethods(expandedCodes, sample, alreadyCreated.map(i=>i.analysis), db);

    // 1. Create OPERATIONAL GATE Work Items (Drying, Prep)
    const opsGates = [
        { code: 'DRYING', name: 'Drying' },
        { code: 'PREPARATION', name: 'Preparation (Milling/Grinding)' }
    ];

    for (const gate of opsGates) {
        const existing = await db.workItem.findFirst({
            where: { sampleId: String(id), analysis: gate.code }
        });
        if (existing) continue;

        const wiId = `WI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const history = [{
            status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
            timestamp: new Date().toISOString(),
            note: 'Work Item Generated'
        }];

        const wi = await db.workItem.create({
            data: {
                id: wiId,
                sampleId: String(id),
                labId: labId,
                assignedLab: sample.assignedLab,
                analysis: gate.code,
                category: 'Operational Gates',
                status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
                assignedTo: null,
                priority: 'NORMAL',
                history: JSON.stringify(history)
            }
        });
        workItems.push(wi);

        await db.auditLog.create({
            data: {
                id: `audit-wi-gen-${Date.now()}-${Math.random()}`,
                entity: 'SAMPLE',
                entityId: String(id),
                action: 'WORKITEM_GENERATED',
                details: `System generated gate: ${gate.name}`,
                performedBy: 'SYSTEM',
                performedByName: 'System',
                timestamp: new Date(),
                analysisCode: gate.code
            }
        });
    }

    // 2. Create ANALYTICAL Work Items (with compound parameter expansion)


    if (requiredAnalyses && Array.isArray(requiredAnalyses)) {
        const uniqueAnalyses = normalizeAnalysisCodes(requiredAnalyses);

        // WP-25: Drive workflow work item ordering from catalogue executionOrder
        const catalogueRecords = await db.analysis.findMany({
            where: { code: { in: uniqueAnalyses } },
            select: { code: true, executionOrder: true }
        });
        const orderMap = {};
        catalogueRecords.forEach(a => { orderMap[a.code] = a.executionOrder ?? 100; });
        uniqueAnalyses.sort((a, b) => (orderMap[a] ?? 100) - (orderMap[b] ?? 100));

        for (const analysisCode of uniqueAnalyses) {
            const existing = await db.workItem.findFirst({
                where: { sampleId: String(id), analysis: analysisCode }
            });
            if (existing) continue;

            const record=await db.analysis.findUnique({where:{code:analysisCode},select:{name:true,category:{select:{name:true}}}});
            const name=record?.name||analysisCode,category=record?.category?.name||'Uncategorized';
            const wiId = `WI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const history = [{
                status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
                timestamp: new Date().toISOString(),
                note: 'Work Item Generated'
            }];

            // WP-20: Resolve methodology for this lab and analysis
            const defaultMethodId = defaultMethods.get(analysisCode) || null;

            const wi = await db.workItem.create({
                data: {
                    id: wiId,
                    sampleId: String(id),
                    labId: labId,
                    assignedLab: sample.assignedLab,
                    analysis: analysisCode,
                    category: category,
                    status: workflow.WORK_ITEM_STATES.NOT_ASSIGNED,
                    assignedTo: null,
                    priority: 'NORMAL',
                    methodologyId: defaultMethodId,
                    history: JSON.stringify(history)
                }
            });
            workItems.push(wi);

            await db.auditLog.create({
                data: {
                    id: `audit-wi-gen-${Date.now()}-${Math.random()}`,
                    entity: 'SAMPLE',
                    entityId: String(id),
                    action: 'WORKITEM_GENERATED',
                    details: `System generated analysis: ${name}`,
                    performedBy: 'SYSTEM',
                    performedByName: 'System',
                    timestamp: new Date(),
                    analysisCode: analysisCode
                }
            });
        }
    }

    // Ensure initial SampleOrderRevision exists
    try {
        const existingRev = await db.sampleOrderRevision.findFirst({
            where: { sampleId: String(id) }
        });
        if (!existingRev && requiredAnalyses && requiredAnalyses.length > 0) {
            const rev = await db.sampleOrderRevision.create({
                data: {
                    sampleId: String(id),
                    version: 1,
                    status: 'ACTIVE',
                    reason: 'Initial order generated at intake',
                    requestedBy: sample.receivedBy || 'RECEPTION',
                    authorizedBy: 'SYSTEM',
                    authorizedAt: new Date()
                }
            });
            for (const code of requiredAnalyses) {
                await db.orderLine.create({
                    data: {
                        revisionId: rev.id,
                        analysis: code,
                        isRequired: true,
                        status: 'ACTIVE'
                    }
                });
            }
        }
    } catch (e) {
        if(strict) throw e;
        console.warn('[generateWorkItemsForSample] Notice: Order revision creation skipped:', e.message);
    }

    return workItems;
};
module.exports={generateWorkItemsForSample,normalizeAnalysisCodes};
