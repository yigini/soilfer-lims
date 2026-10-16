import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
export default function DisposalQueue() {
    const { t } = useLanguage();
    const [rows, setRows] = useState(null), [error, setError] = useState('');
    const load = async () => {
        try { const response = await axios.get('/api/samples/disposal-queue'); setRows(response.data.samples); setError(''); }
        catch { setError(t('custody.loadFailed')); }
    };
    return <section className="p-3 border border-sf-divider rounded-xl">
        <button type="button" onClick={load} className="text-sm font-semibold">{t('custody.disposalQueue')}</button>
        {error && <p role="alert">{error}</p>}
        {rows && <><p className="text-xs text-sf-muted">{t('custody.queueHelp')}</p>
            {rows.length === 0 ? <p className="text-sm">{t('custody.queueEmpty')}</p> : <ul>{rows.map(row => <li key={row.id} className="text-sm">
                <Link to={`/samples/${row.id}`}>{row.labSampleCode || row.originalId}</Link> · {new Date(row.retainUntil).toLocaleDateString()}
            </li>)}</ul>}</>}
    </section>;
}
