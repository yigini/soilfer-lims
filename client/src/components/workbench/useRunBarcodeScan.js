import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { playErrorBuzz, playSuccessChime } from '../../utils/audioCues';
import { runWorksheetRows } from './qcWorksheetNavigation';

const ERROR_KEYS = {
    SAMPLE_NOT_FOUND: 'notFound', SCAN_CHECK_CHARACTER_INVALID: 'checkCharacterInvalid',
    SAMPLE_LOOKUP_AMBIGUOUS: 'ambiguous', SCAN_SAMPLE_NOT_IN_RUN: 'notInRun',
    SCAN_ROW_UNAVAILABLE: 'rowUnavailable', SCAN_RUN_REQUIRED: 'noRun'
};

export function useRunBarcodeScan({ runBatch, selectedRunRef, activeGroup, allGroups, inputRefs,
    onSelectGroup, setSelectedItemId, setSearchQuery, t }) {
    const scanRef = useRef(null), request = useRef(0), burst = useRef({ text: '', lastAt: 0 });
    const [value, setValue] = useState(''), [error, setError] = useState(null), [target, setTarget] = useState(null);
    useEffect(() => { request.current++; setTarget(null); setError(null); }, [runBatch?.id]);
    const refuse = code => { setError(t(`barcodeScan.${ERROR_KEYS[code] || 'notFound'}`)); playErrorBuzz(); };
    const rejectValueBurst = () => { setError(t('barcodeScan.valueCell')); playErrorBuzz(); };
    const scan = async () => {
        const code = value.trim(), batchId = runBatch?.id, generation = ++request.current;
        setTarget(null); setError(null);
        if (!batchId) { refuse('SCAN_RUN_REQUIRED'); return; }
        if (!code) return;
        try {
            const response = await axios.get('/api/samples/lookup', { params: { code, scanLabId: runBatch.labId } });
            if (request.current !== generation || selectedRunRef.current !== batchId) return;
            const sample = response.data.data || response.data;
            // The stored issued label and original ID are the authority. A
            // current policy must never reinterpret a successful exact match.
            if (sample.labSampleCode !== code && sample.originalId !== code) { refuse('SAMPLE_NOT_FOUND'); return; }
            if (!runBatch.positions.some(position => position.sampleId === sample.id && position.workItems?.length)) {
                refuse('SCAN_SAMPLE_NOT_IN_RUN'); return;
            }
            let found, group;
            for (const candidate of [activeGroup, ...allGroups.filter(row => row !== activeGroup)]) {
                if (!candidate) continue;
                found = runWorksheetRows(runBatch.positions, candidate.items || [], candidate.analysis)
                    .find(row => row.item?.sampleId === sample.id);
                if (found) { group = candidate; break; }
            }
            if (!found) { refuse('SCAN_ROW_UNAVAILABLE'); return; }
            const workItemId = found.item.workItemId || found.item.id;
            setSearchQuery(''); setSelectedItemId(workItemId); setValue('');
            if (group.analysis !== activeGroup?.analysis) onSelectGroup(group.analysis);
            setTarget({ workItemId, generation, batchId });
        } catch (failure) {
            if (request.current === generation && selectedRunRef.current === batchId)
                refuse(failure.response?.data?.code || 'SAMPLE_NOT_FOUND');
        }
    };
    useEffect(() => {
        if (!target || activeGroup?.items?.every(item => (item.workItemId || item.id) !== target.workItemId)) return;
        const frame = window.requestAnimationFrame(() => {
            if (request.current !== target.generation || selectedRunRef.current !== target.batchId) return;
            const input = inputRefs.current.get(target.workItemId);
            if (!input || input.disabled) { refuse('SCAN_ROW_UNAVAILABLE'); setTarget(null); return; }
            input.closest('tr')?.scrollIntoView({ block: 'center' }); input.focus();
            setTarget(null); playSuccessChime();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [target, activeGroup, inputRefs, selectedRunRef]);
    useEffect(() => {
        if (typeof window.addEventListener !== 'function') return;
        const keyDown = event => {
            if (event.key === 'F2') {
                event.preventDefault(); scanRef.current?.focus(); return;
            }
            const editable = event.target?.closest?.('input,textarea,select,[contenteditable="true"]');
            if (editable || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1 || !runBatch) {
                burst.current = { text: '', lastAt: 0 }; return;
            }
            const now = Date.now(), previous = burst.current;
            const text = now - previous.lastAt < 30 ? previous.text + event.key : event.key;
            burst.current = { text, lastAt: now };
            if (text.length > 1) {
                event.preventDefault(); setValue(text);
                // Prefill before the next wedge key's browser default action.
                if (scanRef.current) { scanRef.current.value = text; scanRef.current.focus(); }
            }
        };
        window.addEventListener('keydown', keyDown, true);
        return () => { window.removeEventListener('keydown', keyDown, true); request.current++; };
    }, [runBatch]);
    return { scanRef, value, setValue, error, scan, rejectValueBurst };
}
