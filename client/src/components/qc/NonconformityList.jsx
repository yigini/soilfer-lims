import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import contract from '@lims/nonconformity';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function NonconformityList({ refreshKey = 0 }) {
    const { token } = useAuth();
    const { t } = useLanguage();
    const [status, setStatus] = useState('');
    const [source, setSource] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const load = useCallback(async (signal) => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('/api/nonconformities', { signal,
                headers: { Authorization: `Bearer ${token}` }, params: { ...(status && { status }), ...(source && { source }) } });
            setRows(response.data.rows);
        } catch (failure) {
            if (signal.aborted) return;
            setRows([]);
            setError(failure.response?.data?.code || 'NCR_FAILED');
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, [token, status, source]);
    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load, refreshKey]);
    return (
        <section className="p-4 space-y-4" aria-label={t('nonconformity.title')}>
            <div className="flex flex-wrap gap-4">
                <label className="text-xs text-sf-muted">{t('nonconformity.status')}
                    <select value={status} onChange={event => setStatus(event.target.value)} className="block mt-1 p-2 rounded bg-sf-canvas border border-sf-divider text-sf-text">
                        <option value="">{t('nonconformity.allStatuses')}</option>
                        {contract.STATUSES.map(value => <option key={value} value={value}>{t('nonconformity.statuses.' + value)}</option>)}
                    </select>
                </label>
                <label className="text-xs text-sf-muted">{t('nonconformity.source')}
                    <select value={source} onChange={event => setSource(event.target.value)} className="block mt-1 p-2 rounded bg-sf-canvas border border-sf-divider text-sf-text">
                        <option value="">{t('nonconformity.allSources')}</option>
                        {contract.SOURCES.map(value => <option key={value} value={value}>{t('nonconformity.sources.' + value)}</option>)}
                    </select>
                </label>
            </div>
            {loading ? <p className="text-sm text-sf-muted">{t('nonconformity.loading')}</p> : error ?
                <p role="alert" className="text-sm text-rose-600">{t('nonconformity.errors.' + error, t('nonconformity.errors.NCR_FAILED'))}</p> : rows.length === 0 ?
                    <p className="text-sm text-sf-muted">{t('nonconformity.empty')}</p> :
                    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
                        <thead className="text-sf-muted"><tr>
                            <th className="p-2">{t('nonconformity.source')}</th><th className="p-2">{t('nonconformity.status')}</th>
                            <th className="p-2">{t('nonconformity.description')}</th><th className="p-2">{t('nonconformity.raisedBy')}</th>
                        </tr></thead>
                        <tbody className="divide-y divide-sf-divider">{rows.map(row => <tr key={row.id}>
                            <td className="p-2 text-sf-text">{t('nonconformity.sources.' + row.source)}<div className="text-sf-muted break-all">{row.refType}: {row.refId}</div></td>
                            <td className="p-2 text-sf-text">{t('nonconformity.statuses.' + row.status)}</td>
                            <td className="p-2 text-sf-text whitespace-pre-wrap">{row.description}
                                {row.impactAssessment && <div className="mt-1"><strong>{t('nonconformity.impactAssessment')}: </strong>{row.impactAssessment}</div>}
                                {row.correctiveAction && <div className="mt-1"><strong>{t('nonconformity.correctiveAction')}: </strong>{row.correctiveAction}</div>}
                            </td>
                            <td className="p-2 text-sf-text">{row.raisedBy}<div className="text-sf-muted">{new Date(row.createdAt).toLocaleString()}</div></td>
                        </tr>)}</tbody>
                    </table></div>}
        </section>
    );
}
