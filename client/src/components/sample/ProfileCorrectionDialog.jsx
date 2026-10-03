import React, {useState} from 'react';
import axios from 'axios';
import {useLanguage} from '../../context/LanguageContext';
import ProfileReferenceFields, {ProfileReferenceSummary} from '../reception/ProfileReferenceFields';
import {useFocusTrap} from '../../hooks/useFocusTrap';

export default function ProfileCorrectionDialog({sampleId, profile, released, onClose, onSaved}) {
    const {t} = useLanguage();
    const [value, setValue] = useState(undefined);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [operationId] = useState(()=>crypto.randomUUID());
    const dialogRef = useFocusTrap(true, ()=>{if (!busy) onClose();});
    const save = async()=>{
        if (value === undefined || (released && !reason.trim()) || busy) return;
        setBusy(true); setError('');
        try {
            if (released) await axios.post(`/api/samples/${sampleId}/amendments`, {type:'CLERICAL', reason:reason.trim(), expectedProfileRevision:profile?.revision || 0, profileCorrection:value, idempotencyKey:operationId});
            else await axios.put(`/api/samples/${sampleId}/metadata`, {metadata:{profileReference:value}, expectedProfileRevision:profile?.revision || 0});
            onSaved();
        } catch (err) {setError(err.response?.data?.message || t('profileReference.saveFailed'));}
        finally {setBusy(false);}
    };
    return <div className="fixed inset-0 z-[125] bg-black/50 flex items-center justify-center p-4">
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="profile-correction-title" className="max-w-lg w-full max-h-[90dvh] overflow-y-auto rounded-2xl bg-sf-surface border border-sf-divider p-6 space-y-4">
            <h2 id="profile-correction-title" className="text-lg font-bold text-sf-text">{t('profileReference.correct')}</h2>
            <ProfileReferenceSummary profile={profile}/>
            <p className="text-sm text-sf-muted">{t('profileReference.correctionHelp')}</p>
            <ProfileReferenceFields value={value} onChange={setValue} current={profile} disabled={busy}/>
            {released && <label className="block text-sm text-sf-text">{t('profileReference.reason')}<textarea autoFocus value={reason} maxLength={4000} onChange={e=>setReason(e.target.value)} disabled={busy} className="mt-1 w-full min-h-24 rounded-lg border border-sf-divider bg-sf-canvas p-3"/></label>}
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
            <div className="flex justify-end gap-3">
                <button onClick={onClose} disabled={busy} className="btn-secondary">{t('common.cancel')}</button>
                <button onClick={save} disabled={busy || value === undefined || (released && !reason.trim())} className="btn-primary">{busy ? t('common.saving') : t('common.save')}</button>
            </div>
        </section>
    </div>;
}
