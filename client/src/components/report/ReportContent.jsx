/**
 * ReportContent — Customer-facing soil analysis report.
 * 
 * This is a PRINT-FIRST document. No dark mode.
 * Think: "What does the farmer receive from the lab?"
 * Designed by a lab manager with 30 years of soil analysis experience.
 *
 * Sections:
 *  1. Lab letterhead (logo, name, address, contact)
 *  2. Report reference (report number, date, sample ID, project)
 *  3. Client info (who requested the analysis)
 *  4. Sample description (what was received, when, from where)
 *  5. Results table (Parameter | Result | Unit | Rating | Reference | Method)
 *  6. Summary of findings & recommendations
 *  7. Methodology footnotes
 *  8. Signature block (auto-signed by lab manager)
 *  9. Disclaimer & footer
 */
import React from 'react';
import './ReportContent.css';

// Visual indicator for agronomic rating tiers returned by server
const LEVEL_INDICATOR = {
    critical: { symbol: '▼▼', color: '#dc2626', label: 'Critical' },
    attention: { symbol: '!', color: '#d97706', label: 'Attention' },
    low: { symbol: '▼', color: '#d97706', label: 'Low' },
    adequate: { symbol: '●', color: '#059669', label: 'Adequate' },
    optimal: { symbol: '●', color: '#059669', label: 'Optimal' },
    high: { symbol: '▲', color: '#d97706', label: 'High' },
};

function formatResultValue(val, decimals, param) {
    if (val === null || val === undefined || val === '') return '—';
    const strVal = String(val).trim();
    if (/^[<>]/.test(strVal)) return strVal; // Preserves censored strings e.g. "<0.005"

    const normalized = strVal.replace(',', '.');
    const num = parseFloat(normalized);
    if (isNaN(num)) return strVal;

    let prec = decimals;
    if (prec === undefined || prec === null) {
        const p = (param || '').toUpperCase();
        if (p.includes('PH')) prec = 1;
        else if (['SAND', 'SILT', 'CLAY'].includes(p)) prec = 1;
        else if (['ZN', 'CU', 'MN', 'FE', 'B', 'MO'].some(t => p.includes(t))) prec = 3;
        else prec = 2;
    }

    return num.toFixed(prec);
}

function toScalar(v, fallback = '—') {
    if (v === null || v === undefined || v === '') return fallback;
    if (typeof v === 'object') {
        if ('value' in v) return toScalar(v.value, fallback);
        if ('label' in v) return toScalar(v.label, fallback);
        if ('name' in v) return toScalar(v.name, fallback);
        return fallback;
    }
    return String(v);
}

// ─── Main Component ──────────────────────────────────────

const ReportContent = ({ data }) => {
    if (!data) return <div style={{ textAlign: 'center', color: '#999', padding: '80px 0' }}>No report content available</div>;

    const { sample, client, project, lab, labBranding, resultGroups, locationData, fieldMetadata, receptionData, signedBy, methodologies, generated, reportNumber } = data;

    const safeGroups = Array.isArray(resultGroups)
        ? resultGroups
        : (resultGroups && typeof resultGroups === 'object')
            ? Object.values(resultGroups)
            : [];

    // Render server-provided interpretations (single engine)
    const allInterpreted = safeGroups.flatMap(g =>
        (g.items || []).map(item => {
            const serverInterp = item.interpretation;
            let interp = null;
            if (serverInterp && serverInterp.rating) {
                const r = serverInterp.rating;
                const level = (r === 'VERY_LOW' || r === 'VERY_HIGH') ? 'critical' : (r === 'LOW' || r === 'HIGH') ? 'attention' : 'optimal';
                interp = {
                    label: serverInterp.label || r,
                    level,
                    advice: serverInterp.advisory || null
                };
            }
            return {
                ...item,
                categoryName: toScalar(g.categoryName, 'General Analyses'),
                interp
            };
        })
    );
    const recommendations = allInterpreted.filter(i => i.interp && (i.interp.level === 'critical' || i.interp.level === 'attention') && i.interp.advice);

    // Check if any result has a method
    const hasMethodColumn = allInterpreted.some(i => i.method || i.standard);

    const reportDate = generated?.at ? new Date(generated.at) : new Date();
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    // Location data (prefer structured locationData, fallback to raw)
    const loc = locationData || {};

    return (
        <div className="report-document">

            {/* ═══════════════════════════════════════════════════
                1. LAB LETTERHEAD
            ═══════════════════════════════════════════════════ */}
            <header className="report-header">
                <div className="report-header-left">
                    {labBranding?.logoUrl && (
                        <img src={labBranding.logoUrl} alt="" className="report-logo" />
                    )}
                    <div>
                        <h1 className="report-lab-name">{toScalar(lab?.name, 'Soil Analysis Laboratory')}</h1>
                        {lab?.address && (
                            <p className="report-lab-detail">{[lab.address, lab.city, lab.country].filter(Boolean).map(x => toScalar(x)).join(', ')}</p>
                        )}
                        <p className="report-lab-detail">
                            {[lab?.phone, lab?.email, lab?.website].filter(Boolean).map(x => toScalar(x)).join(' · ')}
                        </p>
                    </div>
                </div>
                <div className="report-header-right">
                    <div className="report-title-badge">SOIL ANALYSIS REPORT</div>
                    {reportNumber && (
                        <div className="report-number">{toScalar(reportNumber)}</div>
                    )}
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════
                2. REPORT REFERENCE
            ═══════════════════════════════════════════════════ */}
            <table className="report-ref-table">
                <tbody>
                    <tr>
                        <td className="ref-label">Report No.</td>
                        <td className="ref-value ref-mono">{toScalar(reportNumber)}</td>
                        <td className="ref-label">Report Date</td>
                        <td className="ref-value">{fmtDate(reportDate)}</td>
                    </tr>
                    <tr>
                        <td className="ref-label">Laboratory ID</td>
                        <td className="ref-value ref-mono">{toScalar(sample?.labId || sample?.originalId)}</td>
                        <td className="ref-label">Sample Received</td>
                        <td className="ref-value">{fmtDate(sample?.receptionDate)}</td>
                    </tr>
                    <tr>
                        <td className="ref-label">Project</td>
                        <td className="ref-value">{project ? `${toScalar(project.name)} (${toScalar(project.code)})` : '—'}</td>
                        <td className="ref-label">Country</td>
                        <td className="ref-value">{toScalar(loc.country || sample?.countryName)}</td>
                    </tr>
                </tbody>
            </table>

            {/* ═══════════════════════════════════════════════════
                3. CLIENT INFORMATION
            ═══════════════════════════════════════════════════ */}
            <section className="report-section">
                <h2 className="report-section-title">Client Information</h2>
                <table className="report-info-table">
                    <tbody>
                        <tr>
                            <td className="info-label">Name</td>
                            <td className="info-value">{toScalar(client?.fullName)}</td>
                            <td className="info-label">Phone</td>
                            <td className="info-value">{toScalar(client?.phone)}</td>
                        </tr>
                        <tr>
                            <td className="info-label">Email</td>
                            <td className="info-value">{toScalar(client?.email)}</td>
                            <td className="info-label">Organization</td>
                            <td className="info-value">{toScalar(client?.organization || project?.client)}</td>
                        </tr>
                        {client?.address && (
                            <tr>
                                <td className="info-label">Address</td>
                                <td className="info-value" colSpan={3}>{toScalar(client.address)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>

            {/* ═══════════════════════════════════════════════════
                4. SAMPLE DESCRIPTION
            ═══════════════════════════════════════════════════ */}
            <section className="report-section">
                <h2 className="report-section-title">Sample Description</h2>
                <table className="report-info-table">
                    <tbody>
                        <tr>
                            <td className="info-label">Land Use</td>
                            <td className="info-value">{toScalar(loc.landUse || fieldMetadata?.land_use || fieldMetadata?.landUse)}</td>
                            <td className="info-label">Crop Type</td>
                            <td className="info-value">{toScalar(loc.cropType || fieldMetadata?.crop_type || fieldMetadata?.cropType)}</td>
                        </tr>
                        <tr>
                            <td className="info-label">Soil Depth</td>
                            <td className="info-value">{toScalar(loc.soilDepth || fieldMetadata?.soilDepth || fieldMetadata?.soil_depth)}</td>
                            <td className="info-label">Soil Texture</td>
                            <td className="info-value">{toScalar(loc.soilTexture || fieldMetadata?.soilTexture || fieldMetadata?.soil_texture)}</td>
                        </tr>
                        <tr>
                            <td className="info-label">GPS Coordinates</td>
                            <td className="info-value">
                                {loc.gpsLat && loc.gpsLng && !isNaN(Number(loc.gpsLat)) && !isNaN(Number(loc.gpsLng))
                                    ? `${Number(loc.gpsLat).toFixed(5)}°, ${Number(loc.gpsLng).toFixed(5)}°${loc.altitude ? ` (${toScalar(loc.altitude)} m a.s.l.)` : ''}`
                                    : '—'}
                            </td>
                            <td className="info-label">District / Region</td>
                            <td className="info-value">
                                {[loc.district, loc.village, loc.region].filter(Boolean).map(x => toScalar(x)).join(', ') || '—'}
                            </td>
                        </tr>
                        {loc.locationDescription && (
                            <tr>
                                <td className="info-label">Location</td>
                                <td className="info-value" colSpan={3}>{toScalar(loc.locationDescription)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>

            {/* ═══════════════════════════════════════════════════
                5. ANALYSIS RESULTS (CERTIFICATE OF ANALYSIS)
            ═══════════════════════════════════════════════════ */}
            <section className="report-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h2 className="report-section-title" style={{ margin: 0 }}>Certificate of Analysis</h2>
                    <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        Analytical Measurements (ISO/IEC 17025)
                    </span>
                </div>

                {safeGroups.length > 0 ? (
                    safeGroups.map((group, idx) => (
                        <div key={idx} className="report-results-group">
                            <h3 className="report-category-title">{toScalar(group.categoryName, 'Analytical Parameters')}</h3>
                            <table className="report-results-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '32%' }}>Parameter</th>
                                        <th style={{ width: '28%' }}>Method / Standard</th>
                                        <th style={{ width: '20%', textAlign: 'right' }}>Result</th>
                                        <th style={{ width: '20%' }}>Unit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(group.items || []).map((item, i) => {
                                        return (
                                            <tr key={i}>
                                                <td className="param-name">
                                                    {toScalar(item.name || item.param)}
                                                    {item.provenance && item.provenance !== 'MEASURED' && (
                                                        <span style={{
                                                            marginLeft: 8,
                                                            fontSize: '9px',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.04em',
                                                            padding: '1px 6px',
                                                            borderRadius: 4,
                                                            background: item.provenance === 'DERIVED' ? '#f3f4f6' : (item.provenance === 'PREDICTED' ? '#e0f2fe' : '#fef3c7'),
                                                            color: item.provenance === 'DERIVED' ? '#374151' : (item.provenance === 'PREDICTED' ? '#0369a1' : '#92400e'),
                                                            border: '1px solid currentColor',
                                                            fontWeight: 600,
                                                            display: 'inline-block'
                                                        }}>
                                                            {item.provenance === 'DERIVED' ? 'Calculated' : (item.provenance === 'PREDICTED' ? 'Predicted' : 'Imported')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="param-method">{toScalar(item.standard || item.method, 'Standard Laboratory Method')}</td>
                                                <td className="param-value">
                                                    {formatResultValue(item.value, item.decimalPlaces, item.param)}
                                                </td>
                                                <td className="param-unit">{toScalar(item.unit, '—')}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ))
                ) : (
                    <p className="report-empty">No analysis results are available for this sample.</p>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════
                6. SUMMARY & RECOMMENDATIONS
            ═══════════════════════════════════════════════════ */}
            {recommendations.length > 0 && (
                <section className="report-section">
                    <h2 className="report-section-title">Summary of Findings &amp; Recommendations</h2>
                    <div className="report-recommendations">
                        {recommendations.map((item, i) => (
                            <div key={i} className={`recommendation-item ${item.interp.level === 'critical' ? 'rec-critical' : 'rec-attention'}`}>
                                <div className="rec-header">
                                    <strong>{item.name}</strong>
                                    <span className="rec-level" style={{ color: LEVEL_INDICATOR[item.interp.level]?.color }}>
                                        {item.interp.label}
                                    </span>
                                </div>
                                <p className="rec-advice">{item.interp.advice}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ═══════════════════════════════════════════════════
                7. METHODOLOGY FOOTNOTES
            ═══════════════════════════════════════════════════ */}
            {methodologies && methodologies.length > 0 && (
                <section className="report-section report-methods-section">
                    <h2 className="report-section-title">Analytical Methods</h2>
                    <table className="report-methods-table">
                        <thead>
                            <tr>
                                <th>Parameter</th>
                                <th>Method</th>
                                <th>Standard</th>
                            </tr>
                        </thead>
                        <tbody>
                            {methodologies.map((m, i) => (
                                <tr key={i}>
                                    <td>{m.paramName}</td>
                                    <td>{m.method}</td>
                                    <td>{m.standard || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {/* ═══════════════════════════════════════════════════
                8. FOOTER: SIGNATURE, APPROVAL, DISCLAIMER
            ═══════════════════════════════════════════════════ */}
            <footer className="report-footer-section">
                <div className="report-methodology-note">
                    <strong>General Note:</strong> All analyses were performed according to standard laboratory protocols.
                    Results are reported on an air-dry fine-earth (&lt;2 mm) basis unless otherwise indicated.
                </div>

                {/* Approval Trail (SD-17: Separated Episodes on Certificate) */}
                {sample?.episodes && sample.episodes.length > 1 ? (
                    <div className="report-approval-trail space-y-1.5 my-2 p-2.5 bg-gray-50 rounded border border-gray-200">
                        <div className="font-bold text-xs text-gray-800 uppercase tracking-wider">Analytical Approval Passes:</div>
                        {sample.episodes.map(ep => (
                            <div key={ep.episodeNumber} className="text-xs text-gray-700 flex justify-between">
                                <span className="font-semibold">{ep.label}:</span>
                                <span>
                                    {ep.approvedAt ? `Approved by ${ep.approvedBy || 'Manager'} on ${fmtDate(ep.approvedAt)}` : 'In Progress / Current Pass'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : sample?.approvedBy ? (
                    <div className="report-approval-trail">
                        <span className="approval-label">Results Approved:</span>
                        <span className="approval-value">{sample.approvedBy}{sample.approvedAt ? ` — ${fmtDate(sample.approvedAt)}` : ''}</span>
                    </div>
                ) : null}

                {/* Signature Block */}
                <div className="report-signature-block">
                    <div className="signature-column">
                        <div className="signature-signed-area">
                            <div className="signature-name">{signedBy?.name || 'Laboratory Manager'}</div>
                            <div className="signature-esign">✓ Electronically Signed</div>
                        </div>
                        <div className="signature-rule"></div>
                        <div className="signature-title">{signedBy?.title || 'Laboratory Manager'}</div>
                    </div>
                    <div className="signature-column">
                        <div className="signature-signed-area">
                            <div className="signature-date-value">{fmtDate(signedBy?.date || reportDate)}</div>
                        </div>
                        <div className="signature-rule"></div>
                        <div className="signature-title">Date</div>
                    </div>
                </div>

                <div className="report-disclaimer">
                    <p>
                        This report relates only to the sample(s) tested. Results should not be used as the sole basis for
                        soil management decisions. For site-specific recommendations, consult a qualified agronomist.
                    </p>
                    <p>
                        {lab?.name && `© ${new Date().getFullYear()} ${lab.name}. `}
                        This report is confidential and intended for the named recipient only.
                    </p>
                </div>

                <div className="report-generation-info">
                    Report generated on {fmtDate(reportDate)} · {lab?.name || 'Laboratory'} · SoilFER LIMS v{generated?.version || '1.0'}
                </div>
            </footer>
        </div>
    );
};

export default ReportContent;
