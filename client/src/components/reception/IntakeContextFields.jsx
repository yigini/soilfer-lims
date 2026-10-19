import React, { useId } from 'react';
import InfoTooltip from '../common/InfoTooltip';
import { useLanguage } from '../../context/LanguageContext';

export function missingIntakeContext(sampling, rules) {
    const present = value => value !== undefined && value !== null && value !== '';
    const top = sampling.depthTopCm ?? sampling.depthMin, bottom = sampling.depthBottomCm ?? sampling.depthMax;
    const answered = {
        landUse: Boolean(sampling.landUse?.trim()),
        samplingDate: present(sampling.date) && Number.isFinite(new Date(sampling.date).getTime()),
        samplingDepth: /^\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(sampling.depthType || '') ||
            present(top) && present(bottom) && Number.isFinite(Number(top)) && Number.isFinite(Number(bottom)) && Number(top) >= 0 && Number(bottom) >= Number(top),
        composite: typeof sampling.isComposite === 'boolean'
    };
    return Object.entries(rules?.context || {}).filter(([name, rule]) => rule.enabled && rule.required && !answered[name]);
}

export default function IntakeContextFields({ sampling, setSampling, rules }) {
    const { t } = useLanguage();
    const fieldId = useId();
    const update = patch => setSampling(previous => ({ ...previous, ...patch }));
    const inputClass = 'w-full p-2 border rounded-lg bg-sf-surface border-sf-divider text-sf-text';
    const range = /^\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(sampling.depthType || '') ? sampling.depthType.split('-') : [];
    return <div className="grid sm:grid-cols-2 gap-4">{Object.entries(rules?.context || {}).filter(([, rule]) => rule.enabled).map(([name, rule]) =>
        <div key={name} data-field-key={name}>
            <label className="block text-sm font-semibold mb-1" htmlFor={`${fieldId}-${name}`}>
                {t(rule.label)} {rule.required && <span aria-label={t('intakeRules.required')}>*</span>} <InfoTooltip text={t(rule.help)} />
            </label>
            {name === 'landUse' && <select id={`${fieldId}-${name}`} className={inputClass} required={rule.required} value={sampling.landUse || ''} onChange={e => update({ landUse: e.target.value })}>
                <option value="">{t('reception.selectLandUse')}</option>{['Cropland', 'Pasture', 'Forest', 'Garden', 'Greenhouse'].map(value =>
                    <option key={value} value={value}>{t(`reception.${value === 'Garden' ? 'garden' : value.toLowerCase()}`)}</option>)}
            </select>}
            {name === 'samplingDate' && <input id={`${fieldId}-${name}`} className={inputClass} required={rule.required} type="date" value={sampling.date || ''} onChange={e => update({ date: e.target.value })} />}
            {name === 'samplingDepth' && <div className="flex gap-2 items-center">
                <input id={`${fieldId}-${name}`} aria-label={t('intakeRules.depthFrom')} className={inputClass} required={rule.required} min="0" step="any" type="number"
                    value={sampling.depthTopCm ?? sampling.depthMin ?? range[0] ?? ''} onChange={e => update({ depthType: 'Custom', depthMin: undefined, depthTopCm: e.target.value, depthBottomCm: sampling.depthBottomCm ?? sampling.depthMax ?? range[1] ?? '' })} />
                <span>–</span><input aria-label={t('intakeRules.depthTo')} className={inputClass} required={rule.required} min="0" step="any" type="number"
                    value={sampling.depthBottomCm ?? sampling.depthMax ?? range[1] ?? ''} onChange={e => update({ depthType: 'Custom', depthMax: undefined, depthTopCm: sampling.depthTopCm ?? sampling.depthMin ?? range[0] ?? '', depthBottomCm: e.target.value })} /><span>cm</span>
            </div>}
            {name === 'composite' && <select id={`${fieldId}-${name}`} className={inputClass} required={rule.required}
                value={typeof sampling.isComposite === 'boolean' ? String(sampling.isComposite) : ''} onChange={e => update({ isComposite: e.target.value === '' ? undefined : e.target.value === 'true' })}>
                <option value="">{t('intakeRules.unanswered')}</option><option value="true">{t('policies.yes')}</option><option value="false">{t('policies.no')}</option>
            </select>}
        </div>)}</div>;
}
