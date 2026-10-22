import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function useUploadMediaUrls(paths = []) {
    const { token, user } = useAuth() || {};
    const [access, setAccess] = useState(null);
    const revision = JSON.stringify(Array.isArray(paths) ? paths : []);
    const identity = useMemo(() => ({ token, userId: user?.id, revision }), [token, user?.id, revision]);
    useEffect(() => {
        const controller = new AbortController();
        let timer, cancelled = false;
        setAccess(null);
        const selected = [...new Set(JSON.parse(revision).filter(value => typeof value === 'string' &&
            /^\/uploads\/intake\/[A-Za-z0-9][A-Za-z0-9._-]{0,239}$/.test(value)))];
        if (!token || !selected.length) return () => controller.abort();
        const refresh = async () => {
            try {
                const response = await axios.post('/api/uploads/access', { paths: selected },
                    { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
                if (cancelled) return;
                const urls = new Map((response.data.urls || []).filter(row => selected.includes(row.sourceUrl) &&
                    typeof row.url === 'string' && row.url.startsWith(row.sourceUrl + '?token='))
                    .map(row => [row.sourceUrl, row.url]));
                const expiresAt = Number(response.data.expiresAt) * 1000;
                if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Expired image access');
                setAccess({ identity, urls, expiresAt });
                timer = window.setTimeout(refresh, Math.max(1000, Math.min(570000, expiresAt - Date.now() - 30000)));
            } catch {
                if (cancelled) return;
                setAccess(null);
                timer = window.setTimeout(refresh, 30000);
            }
        };
        refresh();
        return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
    }, [identity, token, revision]);
    return useCallback(source => access?.identity === identity && access.expiresAt > Date.now()
        ? access.urls.get(source) : undefined, [identity, access]);
}
