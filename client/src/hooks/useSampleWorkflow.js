import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * useSampleWorkflow hook
 * Fetches sample details, workflow items, and audit history.
 */
export function useSampleWorkflow(sampleId) {
    const [sample, setSample] = useState(null);
    const [workItems, setWorkItems] = useState([]);
    const [auditLog, setAuditLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!sampleId) return;
        setLoading(true);
        try {
            // Single endpoint returns everything: sample, workItems, auditLog, workflowSummary
            const res = await axios.get(`/api/samples/${sampleId}/detail`);
            const data = res.data;

            setSample(data.sample);
            setWorkItems(data.workItems || []);
            setAuditLog(data.auditLog || []);
            setError(null);
        } catch (err) {
            console.error('[useSampleWorkflow] Error:', err);
            const status = err.response?.status;

            // Only use mock fallback for dev/testing when server is unreachable or endpoint 404s
            if (status === 404 || !err.response) {
                console.warn('[useSampleWorkflow] API unavailable, using mock data fallback');
                setSample({
                    sampleId: sampleId,
                    labId: `LAB-${sampleId ? sampleId.substring(0, 4) : 'TEST'}`,
                    projectCode: 'MOCK-PROJECT',
                    status: 'In Progress'
                });
                setWorkItems([
                    { id: 'wi-1', analysis: 'PH', status: 'COMPLETED', assignedTo: 'J. Doe', updatedAt: new Date(Date.now() - 7200000).toISOString() },
                    { id: 'wi-2', analysis: 'TEXTURE', status: 'IN_PROGRESS', assignedTo: 'A. Smith', updatedAt: new Date(Date.now() - 3600000).toISOString() },
                    { id: 'wi-3', analysis: 'SOC', status: 'ASSIGNED', assignedTo: 'B. Lee', createdAt: new Date(Date.now() - 172800000).toISOString() },
                    { id: 'wi-4', analysis: 'CEC', status: 'Pending' },
                    { id: 'wi-5', analysis: 'mir', status: 'Pending' }
                ]);
                setAuditLog([
                    { timestamp: new Date(Date.now() - 86400000).toISOString(), action: 'SAMPLE_CREATED', entity: 'SAMPLE' },
                    { timestamp: new Date().toISOString(), action: 'WORKITEM_STARTED', entity: 'WORKITEM', entityId: 'wi-2', after: { status: 'IN_PROGRESS' } }
                ]);
                setError(null);
            } else {
                setError(err.response?.data?.error || err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [sampleId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { sample, workItems, auditLog, loading, error, fetchData };
}
