import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const StorageMovementModal = ({ sampleId, currentLocation, isOpen, onClose, onSuccess, action = 'MOVED' }) => {
    const { t } = useLanguage();
    const [locations, setLocations] = useState([]);
    const [containers, setContainers] = useState([]);
    const [location, setLocation] = useState('');
    const [containerId, setContainerId] = useState('');
    const [eventType, setEventType] = useState('MOVED');
    const [counterparty, setCounterparty] = useState('');
    const [reference, setReference] = useState('');
    const [reason, setReason] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        setLocation(''); setContainerId(''); setReason(''); setError(''); setNewLocation('');
        setEventType('MOVED'); setCounterparty(''); setReference('');
        Promise.all([axios.get(`/api/samples/${sampleId}/storage-locations`), axios.get(`/api/samples/${sampleId}/containers`)])
            .then(([locs, rows]) => { if (active) { setLocations(locs.data); setContainers(rows.data.containers || rows.data); } })
            .catch(() => { if (active) setError(t('custody.loadFailed')); });
        const key = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', key);
        return () => { active = false; window.removeEventListener('keydown', key); };
    }, [isOpen, sampleId, onClose, t]);
    if (!isOpen) return null;
    const dispose = action === 'DISPOSAL';
    const archive = action === 'ARCHIVING';
    const needsLocation = archive || ['MOVED', 'RETURNED'].includes(eventType);
    const save = async e => {
        e.preventDefault(); setSubmitting(true); setError('');
        try {
            const endpoint = dispose ? 'dispose' : archive ? 'archive' : 'custody';
            await axios.post(`/api/samples/${sampleId}/${endpoint}`, { toLocationId: location || undefined,
                storageLocationId: location || undefined, containerId: containerId || undefined, reason: reason.trim(),
                type: eventType, counterparty: counterparty.trim() || undefined, reference: reference.trim() || undefined });
            onSuccess(); onClose();
        } catch (err) { setError(t(`custody.errors.${err.response?.data?.code}`, err.response?.data?.error || t('custody.saveFailed'))); }
        finally { setSubmitting(false); }
    };
    const createLocation = async () => {
        setSubmitting(true); setError('');
        try {
            const sample = await axios.get(`/api/samples/${sampleId}/detail`);
            const response = await axios.post('/api/inventory/locations', { name: newLocation.trim(), purpose: 'SAMPLE', labId: sample.data.sample.assignedLab });
            setLocations(rows => [...rows, response.data]); setLocation(response.data.id); setNewLocation('');
        } catch (err) { setError(t(`custody.errors.${err.response?.data?.code}`, err.response?.data?.error || t('custody.saveFailed'))); }
        finally { setSubmitting(false); }
    };
    return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="custody-title" className="bg-sf-surface rounded-2xl p-6 w-full max-w-md space-y-4 border border-sf-divider">
            <div className="flex justify-between"><h3 id="custody-title" className="font-bold">{t(dispose ? 'custody.dispose' : archive ? 'custody.archive' : 'custody.recordMovement')}</h3>
                <button type="button" onClick={onClose} aria-label={t('common.close')}><X size={18}/></button></div>
            <p className="text-xs text-sf-muted">{t('custody.currentLocation')}: {currentLocation || t('custody.notRecorded')}</p>
            {dispose && <p className="text-sm">{t('custody.disposalHelp')}</p>}
            {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
            <form onSubmit={save} className="space-y-4">
                {!dispose && !archive && <label className="block text-sm">{t('custody.eventType')}
                    <select value={eventType} onChange={e => { setEventType(e.target.value); setLocation(''); }} className="w-full p-2 border rounded bg-sf-canvas">
                        {['MOVED','ISSUED','RETURNED','SENT_OUT'].map(type => <option key={type} value={type}>{t(`custody.types.${type}`)}</option>)}
                    </select></label>}
                {!dispose && needsLocation && <><label className="block text-sm">{t('custody.newLocation')}
                    <select required value={location} onChange={e => setLocation(e.target.value)} className="w-full p-2 border rounded bg-sf-canvas">
                        <option value="">{t('custody.chooseLocation')}</option>{locations.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
                    </select></label>
                    <div className="flex gap-2"><input aria-label={t('custody.locationName')} placeholder={t('custody.locationName')} value={newLocation} onChange={e => setNewLocation(e.target.value)} className="min-w-0 flex-1 p-2 border rounded bg-sf-canvas"/>
                        <button type="button" disabled={!newLocation.trim() || submitting} onClick={createLocation}>{t('custody.createLocation')}</button></div>
                </>}
                {!dispose && !archive && <label className="block text-sm">{t('custody.container')}
                    <select value={containerId} onChange={e => setContainerId(e.target.value)} className="w-full p-2 border rounded bg-sf-canvas">
                        <option value="">{t('custody.wholeSample')}</option>{containers.map(row => <option key={row.id} value={row.id}>{row.code}</option>)}
                    </select></label>}
                {!dispose && !archive && <><label className="block text-sm">{t('custody.counterparty')}<input value={counterparty} required={['ISSUED','SENT_OUT'].includes(eventType)} onChange={e => setCounterparty(e.target.value)} className="w-full p-2 border rounded bg-sf-canvas"/></label>
                    <label className="block text-sm">{t('custody.reference')}<input value={reference} onChange={e => setReference(e.target.value)} className="w-full p-2 border rounded bg-sf-canvas"/></label></>}
                <label className="block text-sm">{t('custody.reason')}<textarea required value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full p-2 border rounded bg-sf-canvas"/></label>
                <div className="flex justify-end gap-3"><button type="button" onClick={onClose}>{t('common.cancel')}</button>
                    <button type="submit" disabled={submitting || !reason.trim() || !dispose && needsLocation && !location} className="btn-primary">{t(submitting ? 'common.saving' : 'common.save')}</button></div>
            </form>
        </section>
    </div>;
};
export default StorageMovementModal;
