import React from 'react';
import {useLanguage} from '../../context/LanguageContext';

export function ProfileReferenceSummary({profile}) {
    const {t} = useLanguage();
    if (profile?.state === 'CONFLICT') return <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{t('profileReference.conflict')}</p>;
    return <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div><dt className="text-sf-muted">{t('profileReference.label')}</dt><dd className="font-semibold text-sf-text break-all">{profile?.code ?? t('profileReference.unknown')}</dd></div>
        <div><dt className="text-sf-muted">{t('profileReference.namespace')}</dt><dd className="text-sf-text break-all">{profile?.namespace ?? '—'}</dd></div>
        <div><dt className="text-sf-muted">{t('profileReference.meaning')}</dt><dd className="text-sf-text">{t(`profileReference.relations.${profile?.relation || 'UNSPECIFIED'}`)}</dd></div>
    </dl>;
}

export default function ProfileReferenceFields({value, onChange, current, disabled = false}) {
    const {t} = useLanguage();
    const displayed = value === undefined ? current : value;
    const code = displayed?.code ?? '';
    const relation = displayed?.relation || 'SITE_POINT';
    return <fieldset disabled={disabled} className="min-w-0 rounded-xl border border-sf-divider p-4 space-y-3 bg-sf-canvas">
        <legend className="px-1 text-sm font-semibold text-sf-text">{t('profileReference.label')}</legend>
        <p className="text-xs text-sf-muted">{t('profileReference.help')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="min-w-0 text-xs text-sf-muted">{t('profileReference.code')}
                <input value={code} maxLength={255} onChange={e=>onChange({code:e.target.value.trim() === '' ? null : e.target.value, relation:e.target.value.trim() === '' ? 'UNSPECIFIED' : relation === 'UNSPECIFIED' ? 'SITE_POINT' : relation})} className="mt-1 w-full rounded-lg p-2 border border-sf-divider bg-sf-surface text-sm text-sf-text" />
            </label>
            <label className="min-w-0 text-xs text-sf-muted">{t('profileReference.meaning')}
                <select value={code === '' ? 'UNSPECIFIED' : relation} disabled={code === '' || disabled} onChange={e=>onChange({code,relation:e.target.value})} className="mt-1 w-full rounded-lg p-2 border border-sf-divider bg-sf-surface text-sm text-sf-text">
                    {['UNSPECIFIED','SITE_POINT','COMPOSITE','CONFIRMED_PROFILE'].map(key=><option key={key} value={key}>{t(`profileReference.relations.${key}`)}</option>)}
                </select>
            </label>
        </div>
        {relation === 'CONFIRMED_PROFILE' && code !== '' && <p className="text-xs text-sf-muted">{t('profileReference.confirmedHelp')}</p>}
        <p className="text-xs text-sf-muted">{t('profileReference.namespaceHelp')}{current?.namespace ? ` ${current.namespace}` : ''}</p>
        <button type="button" onClick={()=>onChange({code:null,relation:'UNSPECIFIED'})} className="text-xs text-sf-primary underline">{t('profileReference.setUnknown')}</button>
    </fieldset>;
}
