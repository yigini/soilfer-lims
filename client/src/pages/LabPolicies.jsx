import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import LabPolicies from '../components/lab/LabPolicies';

export default function LabPoliciesPage() {
    const { t } = useLanguage();
    const [params, setParams] = useSearchParams();
    const [labs, setLabs] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
    useEffect(() => {
        let current = true;
        axios.get('/api/labs').then(res => { if (current) setLabs(res.data); })
            .catch(() => { if (current) setError(t('policies.loadFailed')); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [t]);
    if (loading) return <p role="status">{t('policies.loading')}</p>;
    if (error) return <p role="alert">{error}</p>;
    const labId = params.get('labId') || labs[0]?.id;
    return <div className="space-y-5">
        <label>{t('policies.laboratory')}<select className="border rounded p-2 ml-3" value={labId || ''}
            onChange={e => setParams({ labId: e.target.value })}>
            {labs.map(lab => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
        </select></label>
        {labId ? <LabPolicies key={labId} labId={labId} /> : <p>{t('policies.noLabs')}</p>}
    </div>;
}
