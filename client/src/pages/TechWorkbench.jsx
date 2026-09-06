import React from 'react';
import { useSearchParams } from 'react-router-dom';
import WorkbenchShell from '../components/workbench/WorkbenchShell';

/**
 * TechWorkbench Page
 * Mounts the redesigned SoilFER LIMS Technician Workbench Shell.
 * Supports deep linking with URL parameters:
 * ?analysis=PH_H2O&methodologyId=ph-water-sop&revision=3&queue=bench.ready&runId=batch-01&sampleId=SMP-001&workItemId=wi-01
 */
export default function TechWorkbench() {
    const [searchParams] = useSearchParams();
    const initialAnalysis = searchParams.get('analysis') || searchParams.get('method') || null;
    const initialMethodologyId = searchParams.get('methodologyId') || null;
    const initialRevision = searchParams.get('revision') ? parseInt(searchParams.get('revision'), 10) : null;
    const initialSampleId = searchParams.get('sampleId') || searchParams.get('sample') || null;
    const initialWorkItemId = searchParams.get('workItemId') || null;
    const initialRunId = searchParams.get('runId') || searchParams.get('batchId') || null;
    const initialQueue = searchParams.get('queue') || null;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <WorkbenchShell
                initialAnalysis={initialAnalysis}
                initialMethodologyId={initialMethodologyId}
                initialRevision={initialRevision}
                initialSampleId={initialSampleId}
                initialWorkItemId={initialWorkItemId}
                initialRunId={initialRunId}
                initialQueue={initialQueue}
            />
        </div>
    );
}
