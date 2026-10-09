import numberParse from '@lims/number-parse';
import { classifyResultValue } from '@lims/result-value-validation';
import { calculateUsdaTexture } from '../../utils/soilCalculations';
import { isEntryReady } from './entryReadiness';

export const resultDraftSignature = item => JSON.stringify([item.draft?.value ?? '', item.draft?.values ?? null, item.draft?.replicateNo ?? 1]);

const fractions = values => Array.isArray(values) ? values : ['sand', 'silt', 'clay'].map(key =>
    values?.[key] ?? values?.[key.toUpperCase()] ?? values?.[key[0].toUpperCase() + key.slice(1)] ?? '');
const parsedKey = parsed => parsed.valid ? JSON.stringify([parsed.value, parsed.qualifier]) : null;

// This is only a client readiness hint. The existing completion preview and
// commit remain responsible for permission, scope, QC and measurement rules.
export function isResultDraftReady(item, group, canEnter) {
    if (!canEnter || !item?.draft || item.draft.conflictValue || !isEntryReady(item, group?.eligibleEquipment || [])) return false;
    const isTexture = item.editorKind === 'TEXTURE' ||
        ['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis'].includes(group?.analysis);
    // A rejected prior attempt is shown as a hint, not the current observation.
    const current = item.status === 'REANALYSIS_REQUIRED' ? null : item.currentResult;
    if (isTexture) {
        const values = fractions(item.draft.values).map(value => numberParse.parseNumber(value, item.numberFormat));
        if (!values.every(value => value.valid && !value.qualifier)) return false;
        if (!calculateUsdaTexture(...values.map(value => value.value), group?.validation?.tolerance ?? null).isValid) return false;
        let stored = current;
        if (typeof stored === 'string') { try { stored = JSON.parse(stored); } catch { stored = null; } }
        const oldValues = fractions(stored?.values || stored?.fractions || stored).map(value => numberParse.parseNumber(value, item.numberFormat));
        return values.some((value, index) => parsedKey(value) !== parsedKey(oldValues[index]));
    }
    const value = numberParse.parseNumber(item.draft.value, item.numberFormat);
    const validation = classifyResultValue(item.draft.value, item.valueRules, item.numberFormat);
    if (validation.severity === 'RED' && !(validation.canOverride && item.overrideRequestId)) return false;
    if (item.sampleReplicates?.requiredCount === 2) {
        // Equal readings in distinct replicate cells are valid independent evidence.
        const number = Number(item.draft.replicateNo ?? 1);
        const retained = item.sampleReplicates.measurements || [];
        return value.valid && !retained.some(row => row.replicateNo === number) &&
            (number === 1 || number === 2 || number === 3 && item.sampleReplicates.canAddThird === true);
    }
    return value.valid && parsedKey(value) !== parsedKey(numberParse.parseNumber(current, item.numberFormat));
}
