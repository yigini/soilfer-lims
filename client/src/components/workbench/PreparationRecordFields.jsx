import { useLanguage } from '../../context/LanguageContext';

// #205: structured preparation evidence the gate confirmation sends as `records`.
const DRYING_METHODS = ['AIR', 'OVEN_40', 'OVEN_105', 'OTHER'];
const STEP_FIELDS = {
    DRYING: ['method', 'temperatureC', 'massBeforeG', 'massAfterG'],
    SIEVING: ['sieveMm', 'massBeforeG', 'coarseFractionG', 'massAfterG'],
    GRINDING: ['grindMm', 'massBeforeG', 'massAfterG'],
    SPLITTING: ['massBeforeG', 'massAfterG']
};

const toLocalInput = iso => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function PreparationRecordFields({ steps = [], records = [], onChange, equipment = [], disabled = false }) {
    const { t } = useLanguage();
    if (!steps.length) return null;
    const recordFor = code => records.find(row => row.gateCode === code) || { gateCode: code };
    const update = (code, field, value) => {
        const next = steps.map(step => step === code ? { ...recordFor(step), [field]: value } : recordFor(step));
        onChange?.(next);
    };
    const label = (key, fallback) => t(`workbench.preparationRecord.${key}`, fallback);
    const input = 'w-full px-2 py-1 rounded border border-sf-divider bg-sf-surface text-sf-text text-xs disabled:opacity-60';

    return (
        <div className="flex flex-col gap-2 mt-1" data-testid="preparation-record-fields">
            {steps.map(code => {
                const record = recordFor(code);
                return (
                    <fieldset key={code} className="border border-sf-divider rounded p-2 grid grid-cols-2 gap-1.5 text-[11px]" disabled={disabled}>
                        <legend className="px-1 font-semibold text-sf-text">{label(`steps.${code}`, code)}</legend>
                        {STEP_FIELDS[code].map(field => field === 'method' ? (
                            <label key={field} className="flex flex-col gap-0.5 text-sf-muted">
                                {label('method', 'Method')}
                                <select className={input} value={record.method || ''} onChange={event => update(code, 'method', event.target.value)}>
                                    <option value="">—</option>
                                    {DRYING_METHODS.map(method => <option key={method} value={method}>{label(`methods.${method}`, method)}</option>)}
                                </select>
                            </label>
                        ) : (
                            <label key={field} className="flex flex-col gap-0.5 text-sf-muted">
                                {label(field, field)}
                                <input type="number" step="any" className={input} value={record[field] ?? ''}
                                    onChange={event => update(code, field, event.target.value)} />
                            </label>
                        ))}
                        {['startedAt', 'endedAt'].map(field => (
                            <label key={field} className="flex flex-col gap-0.5 text-sf-muted">
                                {label(field, field)}
                                <input type="datetime-local" className={input} value={toLocalInput(record[field])}
                                    onChange={event => update(code, field, event.target.value ? new Date(event.target.value).toISOString() : '')} />
                            </label>
                        ))}
                        {equipment.length > 0 && (
                            <label className="flex flex-col gap-0.5 text-sf-muted col-span-2">
                                {label('equipment', 'Equipment')}
                                <select className={input} value={record.equipmentId || ''} onChange={event => update(code, 'equipmentId', event.target.value)}>
                                    <option value="">—</option>
                                    {equipment.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                                </select>
                            </label>
                        )}
                    </fieldset>
                );
            })}
        </div>
    );
}
