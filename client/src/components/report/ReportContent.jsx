/**
 * ReportContent — Professional branded report renderer.
 * Used by both internal (ResultReports modal) and public (PublicReport) views.
 *
 * Props:
 *   data — assembled report payload from reportAssembly.js
 *   showActions — whether to show interactive buttons (false for public/print)
 *   onPrint — optional callback to trigger print
 */
import React from 'react';
import {
    FileText, MapPin, User, Beaker, Shield, Printer,
    AlertTriangle, CheckCircle2, Info, TrendingUp,
    Calendar, Building2, Phone, Mail, Globe
} from 'lucide-react';
import './ReportContent.css';

// ─── Soil interpretation thresholds (simplified FAO/global) ───
const INTERPRETATIONS = {
    PH_H2O: [
        { max: 4.5, label: 'Extremely Acid', level: 'critical', advice: 'Lime application strongly recommended' },
        { max: 5.5, label: 'Strongly Acid', level: 'warn', advice: 'Consider lime application' },
        { max: 6.5, label: 'Moderately Acid', level: 'ok', advice: 'Acceptable for most crops' },
        { max: 7.5, label: 'Neutral', level: 'optimal', advice: 'Optimal range for most crops' },
        { max: 8.5, label: 'Moderately Alkaline', level: 'warn', advice: 'May limit micronutrient availability' },
        { max: 14, label: 'Strongly Alkaline', level: 'critical', advice: 'Gypsum or sulfur application may be needed' },
    ],
    OC: [
        { max: 1.0, label: 'Very Low', level: 'critical', advice: 'Organic matter addition critical' },
        { max: 2.0, label: 'Low', level: 'warn', advice: 'Increase organic inputs' },
        { max: 4.0, label: 'Medium', level: 'ok', advice: 'Maintain current practices' },
        { max: 100, label: 'High', level: 'optimal', advice: 'Good organic matter status' },
    ],
    TOTAL_N: [
        { max: 0.1, label: 'Very Low', level: 'critical', advice: 'Nitrogen supplementation needed' },
        { max: 0.2, label: 'Low', level: 'warn', advice: 'Consider nitrogen fertilization' },
        { max: 0.5, label: 'Medium', level: 'ok', advice: 'Adequate for many crops' },
        { max: 100, label: 'High', level: 'optimal', advice: 'Sufficient nitrogen supply' },
    ],
    AVAIL_P: [
        { max: 5, label: 'Very Low', level: 'critical', advice: 'Phosphorus supplementation needed' },
        { max: 15, label: 'Low', level: 'warn', advice: 'Consider phosphorus fertilization' },
        { max: 25, label: 'Medium', level: 'ok', advice: 'Adequate phosphorus levels' },
        { max: 10000, label: 'High', level: 'optimal', advice: 'Sufficient phosphorus' },
    ],
    EXCH_K: [
        { max: 0.2, label: 'Very Low', level: 'critical', advice: 'Potassium supplementation needed' },
        { max: 0.4, label: 'Low', level: 'warn', advice: 'Consider potassium fertilization' },
        { max: 0.8, label: 'Medium', level: 'ok', advice: 'Adequate potassium levels' },
        { max: 10000, label: 'High', level: 'optimal', advice: 'Sufficient potassium' },
    ],
    EC: [
        { max: 2.0, label: 'Non-Saline', level: 'optimal', advice: 'No salinity concerns' },
        { max: 4.0, label: 'Slightly Saline', level: 'warn', advice: 'May affect sensitive crops' },
        { max: 8.0, label: 'Moderately Saline', level: 'critical', advice: 'Salt-tolerant crops recommended' },
        { max: 100000, label: 'Strongly Saline', level: 'critical', advice: 'Remediation required' },
    ],
};

function getInterpretation(param, value) {
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return null;
    const ranges = INTERPRETATIONS[param];
    if (!ranges) return null;
    for (const range of ranges) {
        if (numVal <= range.max) return range;
    }
    return null;
}

const LEVEL_STYLES = {
    critical: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', icon: AlertTriangle },
    warn: { bg: 'bg-amber-50 dark:bg-amber-900/15', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', icon: AlertTriangle },
    ok: { bg: '', text: 'text-gray-700 dark:text-gray-300', border: '', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: Info },
    optimal: { bg: '', text: 'text-green-700 dark:text-green-400', border: '', badge: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
};

// ─── Main Component ─────────────────────────────────────

const ReportContent = ({ data, showActions = false, onPrint }) => {
    if (!data) return <div className="text-center text-gray-400 py-20">No report content available</div>;

    const { sample, client, project, lab, labBranding, resultGroups, fieldMetadata, receptionData, generated, workItems } = data;

    // Count flags and critical items
    const allItems = resultGroups?.flatMap(g => g.items) || [];
    const flaggedItems = allItems.filter(i => i.flags?.length > 0);
    const interpretedItems = allItems.map(i => ({ ...i, interp: getInterpretation(i.param, i.value) }));
    const criticalCount = interpretedItems.filter(i => i.interp?.level === 'critical').length;
    const warnCount = interpretedItems.filter(i => i.interp?.level === 'warn').length;
    const normalCount = interpretedItems.filter(i => !i.interp || i.interp.level === 'ok' || i.interp.level === 'optimal').length;

    return (
        <div className="report-container space-y-6">

            {/* ─── Lab Header ─── */}
            <div className="report-lab-header text-center border-b-2 border-indigo-600 dark:border-indigo-400 pb-5">
                <div className="flex items-center justify-center gap-4 mb-3">
                    {labBranding?.logoUrl && (
                        <img src={labBranding.logoUrl} alt="Lab logo" className="h-14 w-auto object-contain" />
                    )}
                    <div className="text-left">
                        <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                            {lab?.name || 'Soil Analysis Laboratory'}
                        </h1>
                        {lab?.address && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Building2 size={11} /> {[lab.address, lab.city, lab.country].filter(Boolean).join(', ')}
                            </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                            {lab?.phone && <span className="flex items-center gap-0.5"><Phone size={10} /> {lab.phone}</span>}
                            {lab?.email && <span className="flex items-center gap-0.5"><Mail size={10} /> {lab.email}</span>}
                            {lab?.website && <span className="flex items-center gap-0.5"><Globe size={10} /> {lab.website}</span>}
                        </div>
                    </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-full text-sm font-bold tracking-wide shadow-md">
                    <Beaker size={14} /> SOIL ANALYSIS REPORT
                </div>

                {/* Print action */}
                {showActions && onPrint && (
                    <button
                        onClick={onPrint}
                        className="no-print ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        <Printer size={13} /> Print / Save PDF
                    </button>
                )}
            </div>

            {/* ─── Executive Summary ─── */}
            <div className="report-section p-5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/15 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <h2 className="text-sm font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp size={14} /> Executive Summary
                </h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-3 bg-white/70 dark:bg-gray-800/50 rounded-lg">
                        <div className="text-2xl font-black text-green-600">{normalCount}</div>
                        <div className="text-xs text-gray-500 font-bold">Normal</div>
                    </div>
                    <div className="text-center p-3 bg-white/70 dark:bg-gray-800/50 rounded-lg">
                        <div className="text-2xl font-black text-amber-600">{warnCount}</div>
                        <div className="text-xs text-gray-500 font-bold">Attention</div>
                    </div>
                    <div className="text-center p-3 bg-white/70 dark:bg-gray-800/50 rounded-lg">
                        <div className="text-2xl font-black text-red-600">{criticalCount}</div>
                        <div className="text-xs text-gray-500 font-bold">Critical</div>
                    </div>
                </div>
                {criticalCount > 0 && (
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                        ⚠ {criticalCount} parameter{criticalCount > 1 ? 's' : ''} require{criticalCount === 1 ? 's' : ''} immediate attention.
                        Please review the detailed results and recommendations below.
                    </p>
                )}
                {criticalCount === 0 && warnCount > 0 && (
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                        {warnCount} parameter{warnCount > 1 ? 's' : ''} require{warnCount === 1 ? 's' : ''} monitoring.
                        Overall soil condition is acceptable with areas for improvement.
                    </p>
                )}
                {criticalCount === 0 && warnCount === 0 && allItems.length > 0 && (
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                        ✓ All analyzed parameters are within acceptable ranges. Soil condition is good.
                    </p>
                )}
            </div>

            {/* ─── Client & Sample Info ─── */}
            <div className="report-section grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <User size={13} /> Client Information
                    </h3>
                    <div className="space-y-2 text-sm">
                        <Row label="Name" value={client?.fullName} bold />
                        <Row label="Phone" value={client?.phone} />
                        {project && <Row label="Project" value={`${project.name} (${project.code})`} />}
                        {project?.client && <Row label="Organization" value={project.client} />}
                    </div>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <FileText size={13} /> Sample Details
                    </h3>
                    <div className="space-y-2 text-sm">
                        <Row label="Lab ID" value={sample?.labId} monospace bold />
                        <Row label="Original ID" value={sample?.originalId} monospace />
                        <Row label="Status" value={sample?.status} />
                        <Row label="Received" value={sample?.receptionDate ? new Date(sample.receptionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
                        <Row label="Received By" value={sample?.receivedBy} />
                        {sample?.approvedBy && <Row label="Approved By" value={`${sample.approvedBy} (${sample.approvedAt ? new Date(sample.approvedAt).toLocaleDateString() : ''})`} />}
                    </div>
                </div>
            </div>

            {/* ─── Field Location ─── */}
            {fieldMetadata && Object.keys(fieldMetadata).length > 0 && (
                <div className="report-section p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <MapPin size={13} /> Sampling Location
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {fieldMetadata.latitude && <Row label="Latitude" value={Number(fieldMetadata.latitude).toFixed(6)} />}
                        {fieldMetadata.longitude && <Row label="Longitude" value={Number(fieldMetadata.longitude).toFixed(6)} />}
                        {fieldMetadata.altitude && <Row label="Altitude" value={`${fieldMetadata.altitude} m`} />}
                        {fieldMetadata.land_use && <Row label="Land Use" value={fieldMetadata.land_use} />}
                        {fieldMetadata.soil_depth && <Row label="Soil Depth" value={fieldMetadata.soil_depth} />}
                        {fieldMetadata.sampling_date && <Row label="Sampled" value={fieldMetadata.sampling_date} />}
                        {(fieldMetadata.location_description || fieldMetadata.locationDescription) && (
                            <div className="col-span-2 md:col-span-3">
                                <Row label="Description" value={fieldMetadata.location_description || fieldMetadata.locationDescription} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Analysis Results by Category ─── */}
            {resultGroups && resultGroups.length > 0 ? (
                resultGroups.map((group, idx) => {
                    const groupInterps = group.items.map(item => ({
                        ...item,
                        interp: getInterpretation(item.param, item.value),
                    }));

                    // Category-level advice
                    const categoryAdvice = groupInterps
                        .filter(i => i.interp && (i.interp.level === 'critical' || i.interp.level === 'warn'))
                        .map(i => `**${i.name}** (${i.interp.label}): ${i.interp.advice}`);

                    return (
                        <div key={idx} className="report-section border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h3 className="font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                                    <Beaker size={15} /> {group.categoryName}
                                </h3>
                                <span className="text-xs text-gray-500">{group.items.length} parameter{group.items.length !== 1 ? 's' : ''}</span>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                                    <tr>
                                        <th className="px-5 py-2.5 text-left">Parameter</th>
                                        <th className="px-5 py-2.5 text-right">Result</th>
                                        <th className="px-5 py-2.5 text-left">Unit</th>
                                        <th className="px-5 py-2.5 text-left">Interpretation</th>
                                        <th className="px-5 py-2.5 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {groupInterps.map((item, i) => {
                                        const style = item.interp ? LEVEL_STYLES[item.interp.level] : LEVEL_STYLES.ok;
                                        const rowClass = item.interp?.level === 'critical' ? 'report-flag-critical' :
                                            item.interp?.level === 'warn' ? 'report-flag-warn' : '';
                                        const IconComp = style.icon;

                                        return (
                                            <tr key={i} className={`${rowClass} ${style.bg} transition-colors`}>
                                                <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                                <td className="px-5 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                                                    {item.value != null ? (isNaN(Number(item.value)) ? item.value : Number(item.value).toFixed(2)) : '—'}
                                                </td>
                                                <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{item.unit || '—'}</td>
                                                <td className="px-5 py-3">
                                                    {item.interp ? (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${style.badge}`}>
                                                            <IconComp size={11} /> {item.interp.label}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {item.flags?.length > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                            ⚠ {item.flags.join(', ')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                                                            <CheckCircle2 size={12} /> OK
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Category-level explanations */}
                            {categoryAdvice.length > 0 && (
                                <div className="px-5 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-t border-gray-200 dark:border-gray-700">
                                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                        <Info size={12} /> Recommendations
                                    </h4>
                                    <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                                        {categoryAdvice.map((advice, ai) => (
                                            <li key={ai} className="flex items-start gap-1.5">
                                                <span className="text-amber-500 mt-0.5">•</span>
                                                <span dangerouslySetInnerHTML={{ __html: advice.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    );
                })
            ) : (
                <div className="report-section text-center py-10 text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <Beaker size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-bold">No Analysis Results Available</p>
                    <p className="text-sm mt-1">Results will appear here once laboratory analyses are complete.</p>
                </div>
            )}

            {/* ─── QC & Methodology Notes ─── */}
            {workItems && workItems.length > 0 && (
                <div className="report-section p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Shield size={13} /> Quality Control & Methodology
                    </h3>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                        <p>Analyses were performed following standard laboratory protocols. Results are reported on an oven-dry weight basis unless otherwise noted.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 tracking-wider">
                                <tr>
                                    <th className="px-4 py-2 text-left">Analysis</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                    <th className="px-4 py-2 text-left">Completed</th>
                                    <th className="px-4 py-2 text-left">Analyst</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {workItems.filter(wi => wi.status !== 'NOT_ASSIGNED').map((wi, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{wi.analysis}</td>
                                        <td className="px-4 py-2">
                                            <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold ${wi.status === 'COMPLETED' || wi.status === 'ACCEPTED' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    wi.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                                }`}>{wi.status.replace(/_/g, ' ')}</span>
                                        </td>
                                        <td className="px-4 py-2 text-gray-500">{wi.completedAt ? new Date(wi.completedAt).toLocaleDateString() : '—'}</td>
                                        <td className="px-4 py-2 text-gray-500">{wi.assignedTo || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Generation Footer ─── */}
            <div className="report-footer text-center text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4 mt-6 space-y-1">
                <p className="flex items-center justify-center gap-1.5">
                    <Calendar size={11} />
                    Report generated on {generated?.at ? new Date(generated.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    {' '}by {generated?.byName || 'System'}
                </p>
                <p className="text-gray-300 dark:text-gray-600 font-medium">
                    CONFIDENTIAL — This report is intended for the named client and authorized personnel only.
                    Unauthorized distribution is prohibited.
                </p>
                {lab?.name && (
                    <p className="text-gray-300 dark:text-gray-600">
                        © {new Date().getFullYear()} {lab.name}. All rights reserved.
                    </p>
                )}
            </div>
        </div>
    );
};

// ─── Helper: Label/Value Row ──────────────────────────────
const Row = ({ label, value, bold, monospace }) => {
    if (!value) return null;
    return (
        <div className="flex items-baseline gap-2">
            <span className="text-gray-500 dark:text-gray-400 shrink-0">{label}:</span>
            <span className={`${bold ? 'font-bold' : 'font-medium'} ${monospace ? 'font-mono text-indigo-600 dark:text-indigo-400' : ''} text-gray-900 dark:text-white`}>
                {value}
            </span>
        </div>
    );
};

export default ReportContent;
