import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { getAnalysisDisplayName } from '../utils/analysisNames';

const CatalogueContext = createContext({ analyses: [], getName: getAnalysisDisplayName });
export const notifyCatalogueChanged = () => window.dispatchEvent(new Event('analysis-catalogue-changed'));

// Names belong to the current session scope; never persist a previous lab's catalogue.
export function AnalysisCatalogueProvider({ children }) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const scope = user ? `${user.username}:${user.role}:${user.labId || ''}` : '';
    const [loaded, setLoaded] = useState({ scope: '', analyses: [] });
    useEffect(() => {
        if (!scope) return;
        let alive = true;
        let request = 0;
        const refresh = async () => {
            const current = ++request;
            try {
                const { data } = await axios.get('/api/config/analyses');
                if (alive && current === request && Array.isArray(data)) setLoaded({ scope, analyses: data });
            } catch { /* Existing screens retain their own explicit loading/error states. */ }
        };
        refresh();
        window.addEventListener('focus', refresh);
        window.addEventListener('analysis-catalogue-changed', refresh);
        return () => { alive = false; window.removeEventListener('focus', refresh); window.removeEventListener('analysis-catalogue-changed', refresh); };
    }, [scope]);
    const analyses = useMemo(() => loaded.scope === scope ? loaded.analyses : [], [loaded, scope]);
    const names = useMemo(() => new Map(analyses.map(a => [a.code, a.name])), [analyses]);
    const getName = useCallback((code, fallback) => {
        if (!code) return fallback || '—';
        const rawDefault = names.get(code) || fallback;
        const base = getAnalysisDisplayName(code, rawDefault);
        return t(`dynamic.analysis.${code}.name`, base);
    }, [names, t]);
    const value = useMemo(() => ({ analyses, getName }), [analyses, getName]);
    return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export const useAnalysisCatalogue = () => useContext(CatalogueContext);
export const useAnalysisNames = () => useContext(CatalogueContext).getName;
