import React from 'react';
import {useLanguage} from '../../context/LanguageContext';
import {formCriteria,formLabel} from '../reception/intakeForm';
import {IntakeRuleSummary,IntakeContextFields} from '../reception/IntakeFormContext';

export default function IntakeHistory({sample}) {
    const {t,locale}=useLanguage();
    let record;
    try {record=typeof sample?.receptionData==='string' ? JSON.parse(sample.receptionData) : sample?.receptionData;} catch {return null;}
    const snapshot=record?.intakeTemplate;
    if (!snapshot?.schema) return null;
    const form={...snapshot,...snapshot.schema};
    return <section className="rounded-xl border border-sf-divider bg-sf-surface p-4 space-y-3 mb-4">
        <IntakeRuleSummary form={form}/>
        <dl className="space-y-2 text-sm text-sf-text">{formCriteria(form).map(rule=><div key={rule.id} className="flex flex-wrap justify-between gap-2 border-b border-sf-divider pb-2"><dt>{formLabel(rule,locale)}</dt><dd>{snapshot.checklist?.items?.[rule.id]?.status || t('intakeRules.unrecorded')}{snapshot.checklist?.items?.[rule.id]?.note && <span className="block text-sf-muted">{snapshot.checklist.items[rule.id].note}</span>}</dd></div>)}</dl>
        <IntakeContextFields form={form} values={snapshot.contextAnswers || {}} readOnly/>
        <p className="text-xs text-sf-muted">{snapshot.recordedAt && new Date(snapshot.recordedAt).toLocaleString(locale)} · {t('intakeRules.source.SAVED_REVISION')}</p>
    </section>;
}
