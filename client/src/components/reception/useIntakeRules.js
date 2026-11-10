import { useEffect, useState } from 'react';
import axios from 'axios';

const emptyRules = { rules: null, error: null };

function requestFailure(err) {
    const response = err.response;
    const data = response?.data;
    const code = typeof data?.code === 'string' ? data.code : null;
    const message = [data?.message, data?.error].find(value => typeof value === 'string' && value.trim());
    return { code, message, network: !response && (err.code === 'ERR_NETWORK' || Boolean(err.request)) };
}

export function intakeRulesErrorText(error, t) {
    const message = error?.message || t(error?.network ? 'intakeRules.unavailable' : 'intakeRules.loadFailed');
    return error?.code ? message + ' (' + error.code + ')' : message;
}

export default function useIntakeRules({ sampleId, originalId, projectId, isWalkIn, labId, enabled = true }) {
    const [state, setState] = useState(null);
    const requestKey = JSON.stringify([sampleId, originalId, projectId, Boolean(isWalkIn), labId]);
    useEffect(() => {
        let current = true;
        setState(null);
        if (!enabled) return;
        axios.get('/api/reception/intake-rules', { params: { sampleId: sampleId || undefined,
            originalId: originalId || undefined,
            projectId: projectId || undefined, isWalkIn: Boolean(isWalkIn), assignedLab: labId || undefined } })
            .then(response => {
                if (current) setState({ requestKey, rules: response.data.rules, error: null });
            })
            .catch(err => {
                if (current) setState({ requestKey, rules: null, error: requestFailure(err) });
            });
        return () => { current = false; };
    }, [sampleId, originalId, projectId, isWalkIn, labId, enabled, requestKey]);
    return enabled && state?.requestKey === requestKey ? { rules: state.rules, error: state.error } : emptyRules;
}
