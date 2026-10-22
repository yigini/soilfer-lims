import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Capabilities remain in component memory and are replaced on session/sample
// changes. The browser never constructs an upstream media URL request.
export default function useKoboMediaUrls(sample) {
    const { token, user } = useAuth() || {};
    const [access, setAccess] = useState(null);
    const sampleId = sample?.id;
    const revision = JSON.stringify([sample?.metadata, sample?.fieldMetadata, sample?.updatedAt]);
    const identity = useMemo(() => ({ sampleId, token, userId: user?.id, revision }),
        [sampleId, token, user?.id, revision]);

    useEffect(() => {
        const controller = new AbortController();
        let timer, cancelled = false;
        setAccess(null);
        if (!sampleId || !token) return () => controller.abort();
        const refresh = async () => {
            try {
                const response = await axios.get(`/api/kobo/media/samples/${encodeURIComponent(sampleId)}`,
                    { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
                if (cancelled) return;
                const urls = new Map((response.data.urls || [])
                    .filter(item => typeof item.sourceUrl === 'string' && typeof item.url === 'string' &&
                        item.url.startsWith('/api/kobo/media?token='))
                    .map(item => [item.sourceUrl, item.url]));
                const expiresAt = Number(response.data.expiresAt) * 1000;
                if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Expired media access');
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
    }, [identity, sampleId, token]);

    return useCallback((...sources) => {
        if (access?.identity !== identity || access.expiresAt <= Date.now()) return undefined;
        return sources.map(source => access.urls.get(source)).find(Boolean);
    }, [access, identity]);
}
