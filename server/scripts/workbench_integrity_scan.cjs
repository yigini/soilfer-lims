'use strict';

/**
 * Workbench Integrity Scan & Dry-Run Reconciliation Tool
 * 
 * Inspects samples (especially W001) for:
 * 1. Operational Gate Evidence Gaps (e.g. preparation completed with bare 'Done' without checklist)
 * 2. Order Revision vs. Work Item Coherence (e.g. Plant order revision vs Soil work items)
 * 3. Submission / Review Status Coherence (e.g. accepted items with pending submission)
 * 4. Multiple active order revisions or missing active revision
 * 
 * Usage:
 *   node server/scripts/workbench_integrity_scan.cjs [sampleId]
 *   node server/scripts/workbench_integrity_scan.cjs --all
 */

const prisma = require('../prisma');

async function scanSample(sampleId) {
    const sample = await prisma.sample.findFirst({
        where: {
            OR: [
                { id: sampleId },
                { originalId: sampleId },
                { labId: sampleId }
            ]
        },
        include: {
            workItems: true,
            orderRevisions: {
                include: { lines: true },
                orderBy: { version: 'desc' }
            }
        }
    });

    if (!sample) {
        return { error: `Sample '${sampleId}' not found.` };
    }

    const submissions = await prisma.submission.findMany({
        where: { sampleId: sample.id },
        include: { workItems: true }
    });

    const report = {
        sampleId: sample.id,
        originalId: sample.originalId,
        labId: sample.labId,
        status: sample.status,
        matrix: sample.matrix,
        assignedLab: sample.assignedLab,
        findings: [],
        remediationOptions: []
    };

    // 1. Check Operational Gates
    const prepItem = sample.workItems.find(w => w.analysis === 'PREPARATION');
    const dryingItem = sample.workItems.find(w => w.analysis === 'DRYING');

    if (sample.preparationStatus === 'DONE' || prepItem?.status === 'COMPLETED' || prepItem?.status === 'ACCEPTED') {
        let hasValidPrepEvidence = false;
        let prepResultRaw = prepItem ? prepItem.result : null;
        if (prepResultRaw) {
            try {
                const parsed = typeof prepResultRaw === 'string' ? JSON.parse(prepResultRaw) : prepResultRaw;
                if (parsed && (parsed.kind === 'operational-checklist-v1' || parsed.receiptId || Array.isArray(parsed.checklist))) {
                    hasValidPrepEvidence = true;
                }
            } catch (e) {}
        }

        if (!hasValidPrepEvidence) {
            report.findings.push({
                severity: 'HIGH',
                code: 'PREP_EVIDENCE_GAP',
                message: `Preparation is marked complete (result: '${prepResultRaw || 'none'}'), but has NO procedural checklist receipt.`,
                affectedWorkItemId: prepItem ? prepItem.id : null,
                currentStatus: prepItem ? prepItem.status : sample.preparationStatus
            });
            report.remediationOptions.push({
                id: 'PREP_RECOVERY',
                action: 'Documented Retrospective Verification OR New Preparation Attempt',
                description: 'Manager must either verify physical bench logs retrospectively (with source citation) or authorize a new preparation run. Generic approval must not launder the missing evidence.'
            });
        }
    }

    if (sample.dryingStatus === 'DONE' || dryingItem?.status === 'COMPLETED' || dryingItem?.status === 'ACCEPTED') {
        let hasValidDryingEvidence = false;
        let dryingResultRaw = dryingItem ? dryingItem.result : null;
        if (dryingResultRaw) {
            try {
                const parsed = typeof dryingResultRaw === 'string' ? JSON.parse(dryingResultRaw) : dryingResultRaw;
                if (parsed && (parsed.kind === 'operational-checklist-v1' || parsed.receiptId || Array.isArray(parsed.checklist))) {
                    hasValidDryingEvidence = true;
                }
            } catch (e) {}
        }

        if (!hasValidDryingEvidence) {
            report.findings.push({
                severity: 'MEDIUM',
                code: 'DRYING_EVIDENCE_GAP',
                message: `Drying is marked complete (result: '${dryingResultRaw || 'none'}'), but has NO procedural checklist receipt.`,
                affectedWorkItemId: dryingItem ? dryingItem.id : null
            });
        }
    }

    // 2. Check Order Revision Coherence
    const allRevisions = sample.orderRevisions || [];
    const activeRevisions = allRevisions.filter(r => r.status === 'ACTIVE');

    if (activeRevisions.length === 0 && allRevisions.length > 0) {
        report.findings.push({
            severity: 'HIGH',
            code: 'NO_ACTIVE_ORDER_REVISION',
            message: `Sample has ${allRevisions.length} order revision(s), but NONE is marked ACTIVE. Latest is v${allRevisions[0].version} (${allRevisions[0].status}).`
        });
    } else if (activeRevisions.length > 1) {
        report.findings.push({
            severity: 'HIGH',
            code: 'MULTIPLE_ACTIVE_REVISIONS',
            message: `Multiple active order revisions (${activeRevisions.map(r => 'v' + r.version).join(', ')}) detected.`
        });
    }

    const activeRev = activeRevisions[0] || null;
    if (activeRev) {
        const orderAnalyses = (activeRev.lines || []).map(l => l.analysis).sort();
        const analyticalTasks = sample.workItems
            .filter(w => !['DRYING', 'PREPARATION', 'ARCHIVING', 'ARCH', 'Archive', 'DISPOSAL', 'DISP', 'Dispose'].includes(w.analysis))
            .map(w => w.analysis)
            .sort();

        const mismatch = orderAnalyses.length !== analyticalTasks.length ||
            orderAnalyses.some((a, i) => a !== analyticalTasks[i]);

        if (mismatch) {
            report.findings.push({
                severity: 'CRITICAL',
                code: 'ORDER_TASK_MISMATCH',
                message: `Active Order Revision v${activeRev.version} specifies ${orderAnalyses.length} analyses (${orderAnalyses.join(', ')}) but ${analyticalTasks.length} active analytical tasks exist (${analyticalTasks.join(', ')}).`,
                orderAnalyses,
                analyticalTasks
            });
            report.remediationOptions.push({
                id: 'ORDER_RECONCILIATION',
                action: 'Lab Manager Formal Order Reconciliation',
                description: `Manager must confirm whether the sample is Soil (${analyticalTasks.length} tasks) or Plant (${orderAnalyses.length} lines). Generate new active SampleOrderRevision v${activeRev.version + 1} with matching OrderLines.`
            });
        }
    }

    // 3. Check Submissions vs Work Items Coherence
    for (const sub of (submissions || [])) {
        if (sub.status === 'PENDING_REVIEW') {
            const acceptedItems = (sub.workItems || []).filter(w => w.status === 'ACCEPTED');
            if (acceptedItems.length > 0) {
                report.findings.push({
                    severity: 'MEDIUM',
                    code: 'SUBMISSION_ITEM_STATUS_INCOHERENCE',
                    message: `Submission ${sub.id} is PENDING_REVIEW, but contains ${acceptedItems.length} work item(s) already marked ACCEPTED (${acceptedItems.map(w => w.analysis).join(', ')}).`,
                    submissionId: sub.id
                });
                report.remediationOptions.push({
                    id: 'SUBMISSION_RECONCILE',
                    action: 'Reconcile Submission Status',
                    description: `Update Submission ${sub.id} status to REVIEWED or PARTIALLY_REVIEWED to match its items.`
                });
            }
        }
    }

    return report;
}

async function main() {
    const args = process.argv.slice(2);
    const target = args[0] || 'W001';

    console.log('='.repeat(70));
    console.log('SOILFER LIMS · WORKBENCH INTEGRITY SCANNER (READ-ONLY)');
    console.log('='.repeat(70));

    let samplesToScan = [];
    if (target === '--all') {
        const all = await prisma.sample.findMany({ select: { id: true } });
        samplesToScan = all.map(s => s.id);
    } else {
        samplesToScan = [target];
    }

    let totalFindings = 0;
    for (const sId of samplesToScan) {
        const result = await scanSample(sId);
        if (result.error) {
            console.log(`[-] ${result.error}`);
            continue;
        }

        console.log(`\nSample: ${result.sampleId} (Original: ${result.originalId || 'N/A'}, Lab ID: ${result.labId || 'N/A'})`);
        console.log(`Matrix: ${result.matrix} · Status: ${result.status} · Lab: ${result.assignedLab}`);

        if (result.findings.length === 0) {
            console.log('  [✓] Integrity OK. No evidence gaps or order discrepancies detected.');
        } else {
            totalFindings += result.findings.length;
            console.log(`  [!] ${result.findings.length} integrity exception(s) detected:`);
            result.findings.forEach((f, idx) => {
                console.log(`    ${idx + 1}. [${f.severity}] ${f.code}: ${f.message}`);
            });

            console.log('\n  Recommended Remediation Options (Zero Automatic Mutation / Manager Authorized):');
            result.remediationOptions.forEach((r, idx) => {
                console.log(`    ${idx + 1}. [${r.id}] ${r.action}`);
                console.log(`       ${r.description}`);
            });
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Scan completed. Total integrity exceptions: ${totalFindings}. Database was NOT modified.`);
    console.log('='.repeat(70));
}

main().catch(err => {
    console.error('Scan failed:', err);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
