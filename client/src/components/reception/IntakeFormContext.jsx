import React from 'react';
import {useLanguage} from '../../context/LanguageContext';
import {formFields, formLabel, formName} from './intakeForm';

export function IntakeRuleSummary({form, error, cached = false}) {
    const {t} = useLanguage();
    return <div className="rounded-xl border border-sf-divider bg-sf-canvas p-3 text-sm min-w-0" role="status">
        <strong className="block text-sf-text">{t('intakeRules.effectiveForm')}</strong>
        {error ? <p className="text-red-700 dark:text-red-300 break-words">{error} · {t('intakeRules.inputKept')}</p> :
            form ? <><p className="text-sf-text break-words">{formName(form,t)} · {t('intakeRules.version')} {form.version}</p>
            <p className="text-sf-muted">{t(`intakeRules.source.${form.resolutionSource}`)} {cached && `· ${t('intakeRules.cached')}`}</p></> :
            <p className="text-sf-muted">{t('intakeRules.resolving')}</p>}
    </div>;
}

export function IntakeContextFields({form, values = {}, onChange, excludeMappings = [], readOnly = false}) {
    const {t,locale} = useLanguage();
    const fields = formFields(form).filter(field => !excludeMappings.includes(field.mapping));
    if (!fields.length) return null;
    const inputClass = 'w-full min-w-0 rounded-lg border border-sf-divider bg-sf-surface text-sf-text p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sf-primary';
    return <fieldset className="rounded-xl border border-sf-divider p-4 min-w-0">
        <legend className="px-1 font-semibold text-sf-text">{t('intakeRules.context')}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(field => <label key={field.id} className="block text-sm text-sf-text min-w-0" data-field-key={field.id}>
                <span className="block mb-1">{formLabel(field,locale)} {field.unit && `(${field.unit})`} {field.required && <span aria-label={t('intakeRules.required')}>*</span>}</span>
                {!field.label?.[locale] && locale !== 'en' && <span className="block text-xs text-sf-muted mb-1">{t('intakeRules.labelFallback')}</span>}
                {field.type === 'boolean' ? <select className={inputClass} disabled={readOnly} value={values[field.id] === true ? 'true' : values[field.id] === false ? 'false' : ''} onChange={e => onChange({...values,[field.id]:e.target.value === '' ? null : e.target.value === 'true'})}>
                    <option value="">{t('intakeRules.unrecorded')}</option><option value="true">{t('common.yes','Yes')}</option><option value="false">{t('common.no','No')}</option>
                </select> : field.type === 'choice' ? <select className={inputClass} disabled={readOnly} value={values[field.id] ?? ''} onChange={e => onChange({...values,[field.id]:e.target.value})}>
                    <option value="">{t('intakeRules.unrecorded')}</option>{field.choices.map(choice => <option key={choice} value={choice}>{['DRY','MOIST','WET','SATURATED'].includes(choice) ? t('intakeRules.moisture.'+choice) : choice}</option>)}
                </select> : field.type === 'textarea' ? <textarea className={inputClass} readOnly={readOnly} maxLength={field.maxLength || 2000} value={values[field.id] ?? ''} onChange={e => onChange({...values,[field.id]:e.target.value})}/> :
                    <input className={inputClass} readOnly={readOnly} type={field.type === 'date' ? 'date' : 'text'} inputMode={field.type === 'number' ? 'decimal' : undefined} maxLength={field.maxLength || 2000} value={values[field.id] ?? ''} onChange={e => onChange({...values,[field.id]:e.target.value})}/>}
                {field.help?.[locale] || field.help?.en ? <span className="block text-xs text-sf-muted mt-1">{field.help?.[locale] || field.help.en}</span> : null}
            </label>)}
        </div>
    </fieldset>;
}
