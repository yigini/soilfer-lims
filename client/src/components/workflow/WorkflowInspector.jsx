import React from 'react';
import { ExternalLink, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * WorkflowInspector
 * Docked right-hand panel (320-360px wide on desktop) showing
 * selected step/node, category, owner, prerequisites checklist, downstream effects,
 * and contextual navigation into workbench/review.
 */
export default function WorkflowInspector({
    selectedItem,
    activeView,
    onTraceDependencies,
    sampleId
}) {
    const navigate = useNavigate();

    if (!selectedItem) {
        return (
            <aside className="sf-inspector" aria-label="Workflow inspector empty state">
                <div className="text-center py-12 text-slate-400">
                    <p className="text-xs">Select any stage or analysis node to inspect prerequisites, owner, and downstream impact.</p>
                </div>
            </aside>
        );
    }

    const {
        title = 'Step',
        category = 'Workflow',
        status = '—',
        tone = '',
        sub = '',
        desc = '',
        owner = 'Unassigned',
        checks = [],
        after = 'Next workflow step',
        room = null,
        workItemId = null
    } = selectedItem;

    const badgeIcon = tone === 'done' ? '✓ ' : (tone === 'active' ? '● ' : (tone === 'warn' ? '△ ' : (tone === 'blocked' ? '✕ ' : '')));

    return (
        <aside className="sf-inspector" aria-label="Selected workflow item" aria-live="polite">
            {/* Top Summary */}
            <div>
                <div className="sf-eyebrow">
                    Selected {category.toLowerCase()} step
                </div>
                <h3>{title}</h3>
                <span className={`sf-pill sf-${tone}`}>
                    {badgeIcon}{status}
                </span>
                <p>{desc}</p>

                <div className="sf-detail-row">
                    <span>Responsible</span>
                    <b>{owner}</b>
                </div>

                {room && (
                    <div className="sf-detail-row">
                        <span>Laboratory Station</span>
                        <b>{room}</b>
                    </div>
                )}

                {sub && (
                    <div className="sf-detail-row">
                        <span>Context</span>
                        <span className="text-right text-xs text-slate-500 dark:text-slate-400">{sub}</span>
                    </div>
                )}
            </div>

            {/* Prerequisites & Verification Checklist */}
            <div className="sf-inspect-section">
                <div className="sf-eyebrow">
                    {checks.length > 0 ? 'Prerequisites' : 'Readiness Criteria'}
                </div>
                {checks.length > 0 ? (
                    <div className="space-y-1.5 mt-2">
                        {checks.map((check, idx) => (
                            <div
                                key={idx}
                                className={`sf-check ${tone === 'blocked' ? 'sf-blocked' : 'sf-ok'}`}
                            >
                                <span>{tone === 'blocked' ? '✕' : '✓'}</span>
                                <span className="text-xs">{check}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Submission, QC evidence, and manager approval must be confirmed prior to proceeding.
                    </p>
                )}
            </div>

            {/* What Follows / Downstream Impact */}
            <div className="sf-inspect-section">
                <div className="sf-eyebrow">What follows</div>
                <p className="text-xs">{after}</p>

                {activeView === 'overview' && onTraceDependencies && selectedItem.id !== 'reception' && selectedItem.id !== 'closure' && (
                    <button
                        type="button"
                        className="sf-inspect-button sf-primary"
                        onClick={onTraceDependencies}
                    >
                        <span>Trace dependencies</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Contextual Workbench / QA Queue links */}
                {room && (
                    <button
                        type="button"
                        className="sf-inspect-button"
                        onClick={() => navigate(`/workbench?sampleId=${sampleId}&room=${encodeURIComponent(room)}`)}
                    >
                        <span>Open Station Workbench</span>
                        <ExternalLink className="w-3 h-3" />
                    </button>
                )}

                {category === 'Review' && (
                    <button
                        type="button"
                        className="sf-inspect-button"
                        onClick={() => navigate(`/manager-queue?sampleId=${sampleId}`)}
                    >
                        <span>Open QA Review Queue</span>
                        <ExternalLink className="w-3 h-3" />
                    </button>
                )}
            </div>
        </aside>
    );
}
