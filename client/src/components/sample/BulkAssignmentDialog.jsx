import React, { useEffect, useId, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import workflow from '../../utils/workflowContract';

const PREP = new Set(['DRYING', 'PREPARATION']);
const CLOSURE_PAIR = { ARCHIVING: 'DISPOSAL', DISPOSAL: 'ARCHIVING' };

async function loadWorkspaces(selection, signal) {
    const sampleIds = new Set(selection.sampleIds);
    if (selection.sampleQuery) {
        let pages = 1;
        for (let page = 1; page <= pages; page++) {
            const { data } = await axios.get('/api/samples', {
                params: { ...selection.sampleQuery, page, limit: 100 }, signal
            });
            pages = data.meta.pages;
            data.data.forEach(sample => sampleIds.add(sample.id));
        }
    }
    const ids = [...sampleIds];
    const workspaces = [];
    for (let offset = 0; offset < ids.length; offset += 4) {
        const group = await Promise.all(ids.slice(offset, offset + 4).map(async id => {
            try {
                const { data } = await axios.get('/api/samples/' + encodeURIComponent(id) + '/workspace', { signal });
                return data.identity.id === id ? data : { id, reason: 'unavailable' };
            } catch (error) {
                if (signal.aborted) throw error;
                const status = error.response?.status;
                if (status === 403 || status === 404) return { id, reason: status === 403 ? 'outsideLab' : 'unavailable' };
                throw error;
            }
        }));
        workspaces.push(...group);
    }
    return workspaces;
}

export function previewBulkAssignment(workspaces, { labId, mode, analyses }) {
    if (!labId) return { eligible: [], skipped: [] };
    const eligible = [];
    const skipped = [];
    for (const workspace of workspaces) {
        const { identity, workItems = [] } = workspace;
        const sample = identity?.displayId || identity?.originalId || workspace.id;
        if (!identity || !workItems.length) {
            skipped.push({ id: identity?.id || workspace.id, sample, reason: workspace.reason || 'noWork' });
            continue;
        }
        const selected = workItems.filter(item => mode === 'all' ||
            (mode === 'prep' && PREP.has(item.analysis)) ||
            (mode === 'analyses' && !PREP.has(item.analysis) && !workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis)) ||
            (mode === 'selected' && analyses.includes(item.analysis)));
        for (const item of selected) {
            const row = { id: item.id, sample, analysis: item.analysis, status: item.status };
            const competing = CLOSURE_PAIR[item.analysis];
            let reason;
            if (identity.assignedLab !== labId) reason = 'outsideLab';
            else if (workspace.held || item.status === 'ON_HOLD') reason = 'held';
            else if (!workspace.capabilities?.canAssign?.allowed) reason = 'sampleNotReady';
            else if (item.assignedTo || !(item.status === 'ASSIGNED' || workflow.isValidWorkItemTransition(item.status, 'ASSIGNED'))) reason = 'workState';
            else if (competing && workItems.some(other => other.analysis === competing && other.assignedTo)) reason = 'closureAlreadyAssigned';
            else if (competing && selected.some(other => other.analysis === competing && !other.assignedTo &&
                (other.status === 'ASSIGNED' || workflow.isValidWorkItemTransition(other.status, 'ASSIGNED')) && other.status !== 'ON_HOLD')) reason = 'chooseClosure';
            if (reason) skipped.push({ ...row, reason });
            else eligible.push(row);
        }
    }
    return { eligible, skipped };
}

export default function BulkAssignmentDialog({ selection, onClose, onAssigned, initialAnalysis = '' }) {
    const { user } = useAuth();
    const fixedLabId = user?.role === 'LAB_MANAGER' ? user.labId : null;
    const { t } = useLanguage();
    const analysisName = useAnalysisNames();
    const titleId = useId();
    const [workspaces, setWorkspaces] = useState(null);
    const [labId, setLabId] = useState(fixedLabId || '');
    const [assignees, setAssignees] = useState([]);
    const [technician, setTechnician] = useState('');
    const [mode, setMode] = useState(initialAnalysis ? 'selected' : 'all');
    const [analyses, setAnalyses] = useState(initialAnalysis ? [initialAnalysis] : []);
    const [priority, setPriority] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loadError, setLoadError] = useState(false);
    const [assigneeError, setAssigneeError] = useState('');
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        loadWorkspaces(selection, controller.signal).then(rows => {
            if (controller.signal.aborted) return;
            setWorkspaces(rows);
            const labs = [...new Set(rows.map(row => row.identity?.assignedLab).filter(Boolean))];
            setLabId(fixedLabId || (labs.length === 1 ? labs[0] : ''));
        }).catch(() => {
            if (!controller.signal.aborted) setLoadError(true);
        });
        return () => controller.abort();
    }, [selection, fixedLabId]);

    useEffect(() => {
        if (!labId || !workspaces) return;
        const controller = new AbortController();
        setTechnician('');
        setAssignees([]);
        setAssigneeError('');
        axios.get('/api/work/eligible-assignees', { params: { labId }, signal: controller.signal }).then(({ data }) => {
            if (!controller.signal.aborted) setAssignees(data.assignees);
        }).catch(error => {
            if (!controller.signal.aborted) setAssigneeError(error.response?.data?.message || t('bulkAssignment.assigneesFailed'));
        });
        return () => controller.abort();
    }, [labId, workspaces, t]);

    const availableLabs = useMemo(() => [...new Set((workspaces || []).map(row => row.identity?.assignedLab).filter(Boolean))], [workspaces]);
    const availableAnalyses = useMemo(() => [...new Set((workspaces || []).flatMap(row => row.workItems || []).map(item => item.analysis))].sort(), [workspaces]);
    const { eligible, skipped } = previewBulkAssignment(workspaces || [], { labId, mode, analyses });
    const prepCount = eligible.filter(row => PREP.has(row.analysis)).length;
    const closureCount = eligible.filter(row => workflow.CLOSURE_TASK_ANALYSES.includes(row.analysis)).length;

    const submit = async event => {
        event.preventDefault();
        if (saving || result || !technician || !eligible.length) return;
        setSaving(true);
        try {
            const { data } = await axios.post('/api/work/assign', {
                workItemIds: eligible.map(row => row.id),
                assignee: technician,
                summarizeNotifications: true,
                ...(priority ? { priority } : {}),
                ...(dueDate ? { dueDate } : {})
            });
            setResult({ assigned: data.assigned, failed: data.errors || [],
                unconfirmed: Math.max(0, eligible.length - data.assigned - (data.errors?.length || 0)) });
            if (data.assigned > 0) onAssigned?.();
        } catch (error) {
            const data = error.response?.data;
            if (error.response?.status >= 400 && error.response.status < 500) {
                setResult({ assigned: 0, failed: data?.errors || eligible.map(row => ({
                    id: row.id, error: data?.message || data?.error || t('bulkAssignment.assignmentFailed')
                })), unconfirmed: 0 });
            } else {
                setResult({ assigned: 0, failed: [], unconfirmed: eligible.length });
                onAssigned?.();
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
            <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby={titleId}
                className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl bg-sf-surface text-sf-text shadow-xl p-5 space-y-4"
                onKeyDown={event => { if (event.key === 'Escape' && !saving) onClose(); }}>
                <h2 id={titleId} className="text-xl font-bold">{t('bulkAssignment.title')}</h2>
                {loadError && <p role="alert" className="text-red-600">{t('bulkAssignment.loadFailed')}</p>}
                {!workspaces && !loadError && <p role="status">{t('bulkAssignment.loading')}</p>}
                {workspaces && (
                    <>
                        <fieldset disabled={saving || Boolean(result)} className="grid gap-3 sm:grid-cols-2">
                            {!fixedLabId && <label className="grid gap-1">
                                {t('bulkAssignment.lab')}
                                <select value={labId} onChange={event => {
                                    setTechnician('');
                                    setAssignees([]);
                                    setLabId(event.target.value);
                                }} className="border border-sf-divider rounded p-2 bg-sf-canvas">
                                    <option value="">{t('bulkAssignment.choose')}</option>
                                    {availableLabs.map(lab => <option key={lab} value={lab}>{lab}</option>)}
                                </select>
                            </label>}
                            <label className="grid gap-1">
                                {t('bulkAssignment.technician')}
                                <select value={technician} onChange={event => setTechnician(event.target.value)}
                                    className="border border-sf-divider rounded p-2 bg-sf-canvas">
                                    <option value="">{t('bulkAssignment.choose')}</option>
                                    {assignees.map(person => <option key={person.id} value={person.username}>{person.name || person.username}</option>)}
                                </select>
                            </label>
                            <label className="grid gap-1">
                                {t('bulkAssignment.workType')}
                                <select value={mode} onChange={event => setMode(event.target.value)}
                                    className="border border-sf-divider rounded p-2 bg-sf-canvas">
                                    {['all', 'prep', 'analyses', 'selected'].map(value => <option key={value} value={value}>{t('bulkAssignment.' + value)}</option>)}
                                </select>
                            </label>
                            {mode === 'selected' && <label className="grid gap-1">
                                {t('bulkAssignment.selectAnalyses')}
                                <select multiple value={analyses} onChange={event => setAnalyses([...event.target.selectedOptions].map(option => option.value))}
                                    className="border border-sf-divider rounded p-2 bg-sf-canvas">
                                    {availableAnalyses.map(code => <option key={code} value={code}>{analysisName(code)}</option>)}
                                </select>
                            </label>}
                            <label className="grid gap-1">
                                {t('bulkAssignment.priority')}
                                <select value={priority} onChange={event => setPriority(event.target.value)}
                                    className="border border-sf-divider rounded p-2 bg-sf-canvas">
                                    <option value="">{t('bulkAssignment.keepCurrent')}</option>
                                    {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(value => <option key={value} value={value}>{t('bulkAssignment.priority_' + value)}</option>)}
                                </select>
                            </label>
                            <label className="grid gap-1">
                                {t('bulkAssignment.dueDate')}
                                <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}
                                    className="border border-sf-divider rounded p-2 bg-sf-canvas" />
                            </label>
                        </fieldset>
                        {assigneeError && <p role="alert" className="text-red-600">{assigneeError}</p>}
                        <div className="rounded border border-sf-divider p-3 space-y-2" aria-live="polite">
                            <p className="font-medium">{t('bulkAssignment.preview', { samples: workspaces.length, items: eligible.length })}</p>
                            <p className="text-sm">{t('bulkAssignment.byType', { prep: prepCount, analyses: eligible.length - prepCount - closureCount, closure: closureCount })}</p>
                            {skipped.length > 0 && <>
                                <p>{t('bulkAssignment.skipped', { count: skipped.length })}</p>
                                <ul className="max-h-32 overflow-auto text-sm list-disc ps-5">
                                    {skipped.map(row => <li key={row.id}>
                                        {row.sample}{row.analysis && ' · ' + analysisName(row.analysis)} · {t('bulkAssignment.reason_' + row.reason,
                                            { status: t('status.' + row.status, row.status || '') })}
                                    </li>)}
                                </ul>
                            </>}
                        </div>
                        {result && (
                            <div className="rounded border border-sf-divider p-3 space-y-2" role="status">
                                <p>{t('bulkAssignment.result', { assigned: result.assigned, skipped: skipped.length, failed: result.failed.length })}</p>
                                {result.unconfirmed > 0 && <p>{t('bulkAssignment.unconfirmed', { count: result.unconfirmed })}</p>}
                                {result.failed.length > 0 && <ul className="max-h-32 overflow-auto text-sm list-disc ps-5">
                                    {result.failed.map(row => {
                                        const item = eligible.find(candidate => candidate.id === row.id);
                                        return <li key={row.id}>{item ? item.sample + ' · ' + analysisName(item.analysis) : row.id} · {row.error}</li>;
                                    })}
                                </ul>}
                            </div>
                        )}
                    </>
                )}
                <div className="flex justify-end gap-2">
                    <button type="button" autoFocus onClick={onClose} disabled={saving} className="rounded border border-sf-divider px-3 py-2">
                        {result ? t('bulkAssignment.close') : t('common.cancel', 'Cancel')}
                    </button>
                    {!result && <button type="submit" disabled={saving || !technician || !eligible.length}
                        className="rounded bg-sf-primary px-3 py-2 font-semibold text-white disabled:opacity-50">
                        {saving ? t('bulkAssignment.saving') : t('bulkAssignment.confirm')}
                    </button>}
                </div>
            </form>
        </div>
    );
}
