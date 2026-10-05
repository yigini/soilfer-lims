export const promptSpectralReason = (showDialog, t) => new Promise(resolve => {
    showDialog({ type: 'prompt', inputRequired: true,
        title: t('spectralWorkflow.reopenTitle'), message: t('spectralWorkflow.reopenMessage'),
        inputPlaceholder: t('spectralWorkflow.reason'), confirmText: t('spectralWorkflow.retry'), cancelText: t('common.cancel'),
        onConfirm: value => { if (value?.trim()) resolve(value.trim()); }, onCancel: () => resolve(null) });
});

// A refusal has made no changes. Retry once with the operator's supplied reason;
// cancel leaves the original form/files intact.
export async function requestWithSpectralReopen(send, showDialog, t) {
    try { return await send(); }
    catch (error) {
        if (error.response?.status !== 409 || error.response?.data?.code !== 'WORKITEM_REOPEN_REQUIRED') throw error;
        const reason = await promptSpectralReason(showDialog, t);
        return reason ? send(reason) : null;
    }
}
