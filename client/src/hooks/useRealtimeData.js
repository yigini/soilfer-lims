import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNotifications } from '../context/NotificationContext';

/**
 * useRealtimeData — Real-time polling hook with smart features.
 * 
 * Features:
 *  - Configurable polling interval (default 15s)
 *  - Page Visibility API — pauses when tab is hidden
 *  - isLive indicator for UI pulse
 *  - lastUpdated timestamp
 *  - isStale flag after staleness threshold
 *  - Diff detection — only triggers re-render if data changed
 *  - Manual refresh function
 *  - Error tracking with retry
 * 
 * @param {string} url - API endpoint to poll
 * @param {object} options
 * @param {number} options.interval - Polling interval in ms (default: 15000)
 * @param {object} options.params - Query params for the request
 * @param {number} options.staleThreshold - Ms before data is considered stale (default: 60000)
 * @param {boolean} options.enabled - Whether polling is enabled (default: true)
 */
export function useRealtimeData(url, options = {}) {
    const {
        interval = 15000,
        params = {},
        staleThreshold = 60000,
        enabled = true,
        wsEvents = [],  // Array of WS event names that trigger immediate refresh
    } = options;

    // Try to get subscribeToEvent from NotificationContext (safe fallback)
    let subscribeToEvent = null;
    try {
        const notif = useNotifications();
        subscribeToEvent = notif?.subscribeToEvent;
    } catch (e) {
        // Context not available — WS features disabled, polling still works
    }

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isLive, setIsLive] = useState(false);
    const [isStale, setIsStale] = useState(false);
    const [dataHash, setDataHash] = useState('');

    const intervalRef = useRef(null);
    const visibleRef = useRef(true);
    const mountedRef = useRef(true);
    const paramsRef = useRef(params);
    paramsRef.current = params;

    // Simple hash for diff detection
    const hashData = useCallback((d) => {
        try {
            return JSON.stringify(d);
        } catch {
            return '';
        }
    }, []);

    const fetchData = useCallback(async (isInitial = false) => {
        if (!mountedRef.current || !enabled) return;

        try {
            if (isInitial) setLoading(true);

            const res = await axios.get(url, { params: paramsRef.current });

            if (!mountedRef.current) return;

            const newHash = hashData(res.data);

            // Only update state if data actually changed
            if (newHash !== dataHash) {
                setData(res.data);
                setDataHash(newHash);
            }

            setLastUpdated(new Date());
            setIsStale(false);
            setIsLive(true);
            setError(null);

            // Flash the live indicator
            setTimeout(() => {
                if (mountedRef.current) setIsLive(false);
            }, 1000);

        } catch (err) {
            if (!mountedRef.current) return;
            setError(err.response?.data?.error || err.message);
            console.error(`[useRealtimeData] Failed to fetch ${url}:`, err.message);
        } finally {
            if (mountedRef.current && isInitial) setLoading(false);
        }
    }, [url, enabled, dataHash, hashData]);

    const refresh = useCallback(() => {
        return fetchData(false);
    }, [fetchData]);

    // Initial fetch
    useEffect(() => {
        mountedRef.current = true;
        fetchData(true);
        return () => { mountedRef.current = false; };
    }, [url, enabled]);

    // Polling
    useEffect(() => {
        if (!enabled) return;

        const startPolling = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                if (visibleRef.current) {
                    fetchData(false);
                }
            }, interval);
        };

        startPolling();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [interval, enabled, fetchData]);

    // Page Visibility API
    useEffect(() => {
        const handleVisibility = () => {
            visibleRef.current = !document.hidden;
            // If page becomes visible again, do an immediate refresh
            if (!document.hidden) {
                fetchData(false);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [fetchData]);

    // Staleness detection
    useEffect(() => {
        if (!lastUpdated) return;

        const checkStale = setInterval(() => {
            const elapsed = Date.now() - lastUpdated.getTime();
            if (elapsed > staleThreshold) {
                setIsStale(true);
            }
        }, 5000);

        return () => clearInterval(checkStale);
    }, [lastUpdated, staleThreshold]);

    // ── WebSocket event subscription for instant refresh ──
    useEffect(() => {
        if (!subscribeToEvent || !wsEvents || wsEvents.length === 0 || !enabled) return;

        let debounceTimer = null;
        const debouncedRefresh = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData(false);
            }, 500);
        };

        const unsubs = wsEvents.map(eventName =>
            subscribeToEvent(eventName, debouncedRefresh)
        );

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            unsubs.forEach(unsub => unsub && unsub());
        };
    }, [subscribeToEvent, wsEvents.join(','), enabled, fetchData]);

    return {
        data,
        loading,
        error,
        lastUpdated,
        isLive,
        isStale,
        refresh,
    };
}

/**
 * LiveIndicator — Reusable component showing connection status.
 * Import and place in any dashboard header.
 */
export function formatLastUpdated(date) {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString();
}

export default useRealtimeData;
