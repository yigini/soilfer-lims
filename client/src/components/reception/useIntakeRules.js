import { useEffect, useState } from 'react';
import axios from 'axios';

export default function useIntakeRules({ sampleId, originalId, projectId, isWalkIn, labId }) {
    const [state, setState] = useState({ rules: null, error: false });
    useEffect(() => {
        let current = true;
        setState({ rules: null, error: false });
        axios.get('/api/reception/intake-rules', { params: { sampleId: sampleId || undefined,
            originalId: originalId || undefined,
            projectId: projectId || undefined, isWalkIn: Boolean(isWalkIn), assignedLab: labId || undefined } })
            .then(response => { if (current) setState({ rules: response.data.rules, error: false }); })
            .catch(() => { if (current) setState({ rules: null, error: true }); });
        return () => { current = false; };
    }, [sampleId, originalId, projectId, isWalkIn, labId]);
    return state;
}
