import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import axios from 'axios';
import { NotificationContext } from '../context/NotificationContext';

/**
 * useSampleWorkflow hook
 * Fetches sample details, workflow items, audit history, and the unified map-state contract.
 * Guarantees zero fabricated data on API errors, supports silent background refreshing,
 * and subscribes to real-time WebSocket push events for instant UI synchronization.
 */
export function useSampleWorkflow(sampleId) {
    const [sample, setSample] = useState(null);
    const [workItems, setWorkItems] = useState([]);
    const [auditLog, setAuditLog] = useState([]);
    const [mapState, setMapState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const isMounted = useRef(true);
    const notifContext = useContext(NotificationContext);
    const subscribeToEvent = notifContext?.subscribeToEvent;

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const fetchData = useCallback(async (silent = false) => {
        if (!sampleId) return;
        if (!silent) setLoading(true);
        else setRefreshing(true);

        try {
            // Fetch detail and map-state in parallel
            const [detailRes, mapRes] = await Promise.all([
                axios.get(`/api/samples/${sampleId}/detail`),
                axios.get(`/api/samples/${sampleId}/map-state`).catch(() => null),
            ]);

            if (!isMounted.current) return;

            const data = detailRes.data;
            setSample(data.sample);
            setWorkItems(data.workItems || []);
            setAuditLog(data.auditLog || []);
            setMapState(mapRes?.data || null);
            setError(null);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('[useSampleWorkflow] Error:', err);
            if (!isMounted.current) return;

            const status = err.response?.status;
            const message = err.response?.data?.error ||
                (status === 404 ? 'Sample not found' : 'Unable to connect to workflow service');

            setError(message);
            // Never fabricate mock data on error
            setSample(null);
            setWorkItems([]);
            setAuditLog([]);
            setMapState(null);
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [sampleId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // WebSocket real-time subscription: silently refresh when work items change
    useEffect(() => {
        if (!subscribeToEvent || !sampleId) return;

        let debounceTimer = null;
        const handleUpdate = (data) => {
            const sId = String(sampleId);
            const matchesSample = !data?.sampleIds ||
                (Array.isArray(data.sampleIds) && (
                    data.sampleIds.some(id => String(id) === sId) ||
                    (sample?.id && data.sampleIds.some(id => String(id) === String(sample.id)))
                ));

            if (matchesSample) {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    fetchData(true);
                }, 350);
            }
        };

        const unsub1 = subscribeToEvent('WORKITEM_UPDATE', handleUpdate);
        const unsub2 = subscribeToEvent('WORKITEM_CHANGED', handleUpdate);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            if (typeof unsub1 === 'function') unsub1();
            if (typeof unsub2 === 'function') unsub2();
        };
    }, [subscribeToEvent, sampleId, sample?.id, fetchData]);

    return {
        sample,
        workItems,
        auditLog,
        mapState,
        loading,
        refreshing,
        error,
        lastUpdated,
        fetchData,
        refresh: () => fetchData(true)
    };
}

