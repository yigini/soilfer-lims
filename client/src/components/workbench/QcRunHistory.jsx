import React from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { StoredQcEvidence } from '../qc/BatchInspectionModal';

export const isNativeRun = batch => Boolean(batch?.analytes?.length) && batch.analytes.every(row => row.provenance === 'NATIVE');
export const isHistoricalRun = (batch, analysisCode) => !isNativeRun(batch) || batch.status === 'CLOSED' ||
    batch.analytes.find(row => row.analysisCode === analysisCode)?.status === 'CLOSED';

export default function QcRunHistory({ batch, onOpenWorksheet = null, onChanged, loading, setLoading, setError }) {
    const { t } = useLanguage(), { hasPermission } = useAuth();
    const canEdit = hasPermission?.('CHANGE_STATUS') === true;
    const native = isNativeRun(batch);
    const rebuild = async () => {
        if (!canEdit || native || batch.status === 'CLOSED' || loading) return;
        setLoading(true); setError(null);
        try {
            await axios.post(`/api/qc/batches/${encodeURIComponent(batch.id)}/rebuild`, {
                workItemIds: (batch.workItems || []).map(item => item.id)
            });
            await onChanged();
        } catch (error) {
            setError(t(`qcRuns.errors.${error.response?.data?.code}`, error.response?.data?.error || error.message));
        } finally { setLoading(false); }
    };
    return <section className="space-y-3" data-testid="qc-run-history">
        {!native && <p data-testid="qc-legacy-readonly">{t('qcWorksheet.legacyReadOnly')}</p>}
        <StoredQcEvidence batch={batch} t={t} />
        {native && batch.status !== 'CLOSED' && onOpenWorksheet && <button type="button" data-testid="open-qc-worksheet"
            disabled={loading} onClick={() => onOpenWorksheet(batch.id)}>{t('qcWorksheet.openWorksheet')}</button>}
        {!native && batch.status !== 'CLOSED' && canEdit && <button type="button" data-testid="rebuild-qc-run"
            disabled={loading} onClick={rebuild}>{t('qcWorksheet.rebuild')}</button>}
    </section>;
}
