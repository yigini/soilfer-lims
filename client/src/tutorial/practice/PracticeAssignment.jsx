import React from 'react';

export default function PracticeAssignment({ sample, assignmentStatusCode = 'initial', assignee = 'techA', onUpdate, onMarkDone, t }) {
    const handleAssign = () => {
        onUpdate('assignmentStatusCode', 'assigned');
        onMarkDone();
    };

    const handleReset = () => {
        onUpdate('assignmentStatusCode', 'initial');
    };

    const handleAssigneeChange = (val) => {
        onUpdate('assignmentAssignee', val);
        onUpdate('assignmentStatusCode', 'initial');
    };

    const isAssigned = assignmentStatusCode === 'assigned';
    const sampleCode = sample?.id || `TRAIN-US-00${sample?.tube || 1}`;

    const statusText = isAssigned
        ? t('practice.assignment.assigned', 'Work orders assigned: Tasks queued for preparation and technician workbench.')
        : t('practice.assignment.pending', 'Select technician workstation and assign methods to initiate analytical testing.');

    return (
        <div className="panel focus" id="practiceAssignmentPanel">
            <div className="row">
                <h3>{t('practice.assignment.title', 'Assign analysis tasks')}</h3>
                <span className="badge clay">{t('practice.tag', 'Local exercise')}</span>
            </div>
            <div className="stack small" style={{ marginTop: '12px', fontSize: '12px' }}>
                <p><b>{t('common.tableSampleId', 'Sample ID')}:</b> {sampleCode}</p>
                <p><b>{t('practice.assignment.methodsLabel', 'Required tests')}:</b> {t('practice.assignment.methodsList', 'pH · Soil texture')}</p>
            </div>
            <div className="form-grid" style={{ marginTop: '14px' }}>
                <label className="label">
                    {t('practice.assignment.assigneeLabel', 'Assigned technician / bench')}
                    <select
                        id="assigneeSelect"
                        value={assignee}
                        onChange={(e) => handleAssigneeChange(e.target.value)}
                    >
                        <option value="techA">{t('practice.assignment.techA', 'Tomas Tech · Station 1 (pH / EC)')}</option>
                        <option value="techB">{t('practice.assignment.techB', 'Sarah Specialist · Station 2 (Texture)')}</option>
                    </select>
                </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <button
                    type="button"
                    className="primary"
                    id="confirmAssignment"
                    disabled={isAssigned}
                    onClick={handleAssign}
                >
                    {t('practice.assignment.assignBtn', 'Assign tests to workbench')}
                </button>
                {isAssigned && (
                    <button
                        type="button"
                        className="quiet"
                        id="resetAssignment"
                        onClick={handleReset}
                    >
                        {t('common.reset', 'Reset')}
                    </button>
                )}
            </div>
            <div
                id="assignmentStatus"
                role="status"
                className={`status ${isAssigned ? 'success' : ''}`}
                style={{ marginTop: '12px' }}
            >
                {statusText}
            </div>
        </div>
    );
}
