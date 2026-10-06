function countRequirements(qcRule, sampleCount, runProfile = {}, qcData = {}, mode) {
    const value = field => qcRule.resolved[field].value;
    const slots = type => (runProfile.qcSlots || []).filter(slot => slot.type === type).length;
    const entries = key => Array.isArray(qcData[key]) ? qcData[key] : [];
    const counts = { BLANK: entries('blanks').length, DUPLICATE: entries('duplicates').length,
        CONTROL: entries('controls').length, LRM: entries('controls').filter(row => row?.referenceUse !== 'CRM').length };
    const enforce = ['REQUIRED_BLOCKING', 'REQUIRED_WARN'].includes(mode);
    const requirements = {};
    function add(type, ruleCount, profileCount, enabled) {
        const offered = enabled ? Math.max(ruleCount, profileCount) : 0;
        const source = !enabled || !enforce ? 'NOT_USED' : profileCount > ruleCount ? 'PROFILE' : 'RULE';
        requirements[type] = { required: enforce ? offered : 0, found: counts[type], source, offered };
    }
    add('BLANK', value('blankPerBatch'), slots('BLANK'), value('blankPerBatch') > 0);
    const every = value('duplicateEvery');
    add('DUPLICATE', every > 0 ? Math.ceil(sampleCount / every) : 0, slots('DUPLICATE'), every > 0);
    // CONTROL slots accept CRM or LRM; the independent LRM requirement never accepts CRM.
    add('CONTROL', 0, slots('CONTROL'), value('lrmPerBatch') > 0 || value('crmEveryNBatches') > 0);
    if (requirements.CONTROL.source !== 'NOT_USED') requirements.CONTROL.source = 'PROFILE';
    add('LRM', value('lrmPerBatch'), 0, value('lrmPerBatch') > 0);
    return requirements;
}
module.exports = { countRequirements };
