import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';

export default function AliquotSelect({ sampleId, value = '', onChange, disabled = false }) {
    const { t } = useLanguage();
    const [rows, setRows] = useState([]), [failed, setFailed] = useState(false);
    useEffect(() => {
        let current = true; setRows([]); setFailed(false);
        axios.get(`/api/samples/${encodeURIComponent(sampleId)}/containers`).then(response => {
            if (!Array.isArray(response.data.containers)) throw new Error('Invalid container response');
            if (current) setRows(response.data.containers.filter(row => row.kind === 'ALIQUOT' && row.status === 'ACTIVE'));
        }).catch(() => { if (current) setFailed(true); });
        return () => { current = false; };
    }, [sampleId]);
    return <label className="block text-xs">{t('containers.aliquot')}
        <select className="block w-full p-2 rounded border border-sf-divider bg-sf-canvas" value={value || ''} disabled={disabled || failed}
            onChange={event => onChange(event.target.value || null)}>
            <option value="">{t('containers.unlinked')}</option>
            {value && !rows.some(row => row.id === value) && <option value={value}>{value}</option>}
            {rows.map(row => <option key={row.id} value={row.id}>{row.code}</option>)}
        </select>{failed && <span role="alert">{t('containers.loadFailed')}</span>}
    </label>;
}
