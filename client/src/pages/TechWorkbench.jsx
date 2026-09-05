import React from 'react';
import { useSearchParams } from 'react-router-dom';
import WorkbenchShell from '../components/workbench/WorkbenchShell';

/**
 * TechWorkbench Page
 * Mounts the redesigned SoilFER LIMS Technician Workbench Shell.
 * Supports deep linking with URL parameters: ?analysis=PH&sampleId=SMP-001
 */
export default function TechWorkbench() {
    const [searchParams] = useSearchParams();
    const initialAnalysis = searchParams.get('analysis') || searchParams.get('method') || null;
    const initialSampleId = searchParams.get('sampleId') || searchParams.get('sample') || null;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <WorkbenchShell
                initialAnalysis={initialAnalysis}
                initialSampleId={initialSampleId}
            />
        </div>
    );
}
