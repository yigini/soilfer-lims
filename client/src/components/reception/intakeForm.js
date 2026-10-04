// These are presentation helpers. The server selects and evaluates the published form.
export const applicable = (rule, context = {}) => rule.enabled !== false &&
    (!rule.matrices?.length || rule.matrices.includes(context.matrix)) &&
    (!rule.origins?.length || rule.origins.includes(context.origin));
export const formCriteria = form => (form?.criteria || []).filter(rule => applicable(rule, form.context));
export const formFields = form => (form?.contextFields || []).filter(rule => applicable(rule, form.context));
export const allowsNA = (rule, context = {}) => rule.allowed?.includes('NA') || rule.naOrigins?.includes(context.origin);
export const formLabel = (rule, locale) => rule.label?.[locale] || rule.label?.en || rule.id;
export const formName = (form,t) => form?.templateId?.startsWith('INTAKE-SEED-') ? t('intakeRules.seedNames.'+form.templateId,form.name) : form?.name;
export const pinFor = form => form && ({templateId: form.templateId, revisionId: form.revisionId, schemaHash: form.schemaHash});
export const draftScope = (user, context, identity, revision) => JSON.stringify([
    String(user?.id || ''), user?.labId || '', context?.projectId || null,
    context?.origin || '', context?.matrix || 'SOIL', identity, revision || null
]);
export const ownedDrafts = (storage, user, context, identity) => {
    const entries = [];
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith('limsi_intake_v2:')) continue;
        try {
            const record = JSON.parse(storage.getItem(key));
            if (record.ownerId === String(user?.id) && record.labId === user?.labId &&
                record.identity === identity && record.context.projectId === (context?.projectId || null) &&
                record.context.origin === context?.origin && record.context.matrix === (context?.matrix || 'SOIL')) entries.push({key, ...record});
        } catch { /* Preserve unreadable records for explicit recovery. */ }
    }
    return entries.sort((a,b) => b.savedAt - a.savedAt);
};
