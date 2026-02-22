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

// ─── Soil Interpretation Thresholds (FAO/Global) ───────────
const THRESHOLDS = {
    PH_H2O: [
        { max: 4.5, label: 'Extremely Acidic', level: 'critical', ref: '6.0 – 7.5', advice: 'Lime application is strongly recommended to raise soil pH.' },
        { max: 5.5, label: 'Strongly Acidic', level: 'low', ref: '6.0 – 7.5', advice: 'Consider lime application to improve nutrient availability.' },
        { max: 6.0, label: 'Moderately Acidic', level: 'low', ref: '6.0 – 7.5', advice: 'Slightly acidic; may benefit from light liming for sensitive crops.' },
        { max: 7.5, label: 'Optimal', level: 'optimal', ref: '6.0 – 7.5', advice: 'pH is within the optimal range for most crops.' },
        { max: 8.5, label: 'Moderately Alkaline', level: 'high', ref: '6.0 – 7.5', advice: 'May limit availability of iron, zinc, and manganese.' },
        { max: 14, label: 'Strongly Alkaline', level: 'critical', ref: '6.0 – 7.5', advice: 'Gypsum or sulfur application may be needed to lower pH.' },
    ],
    OC: [
        { max: 1.0, label: 'Very Low', level: 'critical', ref: '> 2.0 %', advice: 'Organic matter is critically low. Add compost, manure, or crop residues.' },
        { max: 2.0, label: 'Low', level: 'low', ref: '> 2.0 %', advice: 'Increase organic inputs through composting or cover cropping.' },
        { max: 4.0, label: 'Medium', level: 'adequate', ref: '> 2.0 %', advice: 'Adequate organic carbon. Maintain current management practices.' },
        { max: 100, label: 'High', level: 'optimal', ref: '> 2.0 %', advice: 'Good organic matter content. Continue current practices.' },
    ],
    TOTAL_N: [
        { max: 0.1, label: 'Very Low', level: 'critical', ref: '0.1 – 0.2 %', advice: 'Nitrogen supplementation is needed for crop production.' },
        { max: 0.2, label: 'Low', level: 'low', ref: '0.1 – 0.2 %', advice: 'Consider nitrogen fertilization or nitrogen-fixing cover crops.' },
        { max: 0.5, label: 'Medium', level: 'adequate', ref: '0.1 – 0.2 %', advice: 'Adequate nitrogen levels for most crops.' },
        { max: 100, label: 'High', level: 'optimal', ref: '0.1 – 0.2 %', advice: 'Sufficient nitrogen supply.' },
    ],
    AVAIL_P: [
        { max: 5, label: 'Very Low', level: 'critical', ref: '10 – 25 mg/kg', advice: 'Phosphorus application is strongly recommended.' },
        { max: 15, label: 'Low', level: 'low', ref: '10 – 25 mg/kg', advice: 'Consider phosphorus fertilization before planting.' },
        { max: 25, label: 'Medium', level: 'adequate', ref: '10 – 25 mg/kg', advice: 'Adequate for most crops.' },
        { max: 10000, label: 'High', level: 'optimal', ref: '10 – 25 mg/kg', advice: 'Sufficient phosphorus. No additional application needed.' },
    ],
    EXCH_K: [
        { max: 0.2, label: 'Very Low', level: 'critical', ref: '0.3 – 0.8 cmol/kg', advice: 'Potassium supplementation is strongly recommended.' },
        { max: 0.4, label: 'Low', level: 'low', ref: '0.3 – 0.8 cmol/kg', advice: 'Consider potassium fertilization.' },
        { max: 0.8, label: 'Medium', level: 'adequate', ref: '0.3 – 0.8 cmol/kg', advice: 'Adequate potassium levels.' },
        { max: 10000, label: 'High', level: 'optimal', ref: '0.3 – 0.8 cmol/kg', advice: 'Sufficient potassium supply.' },
    ],
    EC: [
        { max: 2.0, label: 'Non-Saline', level: 'optimal', ref: '< 2 dS/m', advice: 'No salinity concerns.' },
        { max: 4.0, label: 'Slightly Saline', level: 'low', ref: '< 2 dS/m', advice: 'May affect salt-sensitive crops. Monitor irrigation quality.' },
        { max: 8.0, label: 'Moderately Saline', level: 'high', ref: '< 2 dS/m', advice: 'Select salt-tolerant crop varieties. Improve drainage.' },
        { max: 100000, label: 'Strongly Saline', level: 'critical', ref: '< 2 dS/m', advice: 'Remediation is required before cropping.' },
    ],
};

function getInterpretation(param, value) {
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    const ranges = THRESHOLDS[param];
    if (!ranges) return null;
    for (const r of ranges) {
        if (num <= r.max) return r;
    }
    return null;
}

// Level → visual indicator for the table
const LEVEL_INDICATOR = {
    critical: { symbol: '▼▼', color: '#dc2626', label: 'Critical' },
    low: { symbol: '▼', color: '#d97706', label: 'Low' },
    adequate: { symbol: '●', color: '#059669', label: 'Adequate' },
    optimal: { symbol: '▲', color: '#059669', label: 'Optimal' },
    high: { symbol: '▲▲', color: '#d97706', label: 'High' },
};

// ─── Main Component ──────────────────────────────────────

const ReportContent = ({ data }) => {
    if (!data) return <div style={{ textAlign: 'center', color: '#999', padding: '80px 0' }}>No report content available</div>;

    const { sample, client, project, lab, labBranding, resultGroups, locationData, fieldMetadata, receptionData, signedBy, methodologies, generated, reportNumber } = data;

    // Build interpretations for all results
    const allInterpreted = (resultGroups || []).flatMap(g =>
        g.items.map(item => ({ ...item, categoryName: g.categoryName, interp: getInterpretation(item.param, item.value) }))
    );
    const recommendations = allInterpreted.filter(i => i.interp && (i.interp.level === 'critical' || i.interp.level === 'low'));

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
                        <h1 className="report-lab-name">{lab?.name || 'Soil Analysis Laboratory'}</h1>
                        {lab?.address && (
                            <p className="report-lab-detail">{[lab.address, lab.city, lab.country].filter(Boolean).join(', ')}</p>
                        )}
                        <p className="report-lab-detail">
                            {[lab?.phone, lab?.email, lab?.website].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                </div>
                <div className="report-header-right">
                    <div className="report-title-badge">SOIL ANALYSIS REPORT</div>
                    {reportNumber && (
                        <div className="report-number">{reportNumber}</div>
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
                        <td className="ref-value ref-mono">{reportNumber || '—'}</td>
                        <td className="ref-label">Report Date</td>
                        <td className="ref-value">{fmtDate(reportDate)}</td>
                    </tr>
                    <tr>
                        <td className="ref-label">Laboratory ID</td>
                        <td className="ref-value ref-mono">{sample?.labId || sample?.originalId || '—'}</td>
                        <td className="ref-label">Sample Received</td>
                        <td className="ref-value">{fmtDate(sample?.receptionDate)}</td>
                    </tr>
                    <tr>
                        <td className="ref-label">Project</td>
                        <td className="ref-value">{project ? `${project.name} (${project.code})` : '—'}</td>
                        <td className="ref-label">Country</td>
                        <td className="ref-value">{loc.country || sample?.countryName || '—'}</td>
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
                            <td className="info-value">{client?.fullName || '—'}</td>
                            <td className="info-label">Phone</td>
                            <td className="info-value">{client?.phone || '—'}</td>
                        </tr>
                        <tr>
                            <td className="info-label">Email</td>
                            <td className="info-value">{client?.email || '—'}</td>
                            <td className="info-label">Organization</td>
                            <td className="info-value">{client?.organization || project?.client || '—'}</td>
                        </tr>
                        {client?.address && (
                            <tr>
                                <td className="info-label">Address</td>
                                <td className="info-value" colSpan={3}>{client.address}</td>
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
                            <td className="info-value">{loc.landUse || fieldMetadata?.land_use || '—'}</td>
                            <td className="info-label">Crop Type</td>
                            <td className="info-value">{loc.cropType || fieldMetadata?.crop_type || '—'}</td>
                        </tr>
                        <tr>
                            <td className="info-label">Soil Depth</td>
                            <td className="info-value">{loc.soilDepth || '—'}</td>
                            <td className="info-label">Soil Texture</td>
                            <td className="info-value">{loc.soilTexture || '—'}</td>
                        </tr>
                        <tr>
                            <td className="info-label">GPS Coordinates</td>
                            <td className="info-value">
                                {loc.gpsLat && loc.gpsLng
                                    ? `${Number(loc.gpsLat).toFixed(5)}°, ${Number(loc.gpsLng).toFixed(5)}°${loc.altitude ? ` (${loc.altitude} m a.s.l.)` : ''}`
                                    : '—'}
                            </td>
                            <td className="info-label">District / Region</td>
                            <td className="info-value">
                                {[loc.district, loc.village, loc.region].filter(Boolean).join(', ') || '—'}
                            </td>
                        </tr>
                        {loc.locationDescription && (
                            <tr>
                                <td className="info-label">Location</td>
                                <td className="info-value" colSpan={3}>{loc.locationDescription}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>

            {/* ═══════════════════════════════════════════════════
                5. ANALYSIS RESULTS
            ═══════════════════════════════════════════════════ */}
            <section className="report-section">
                <h2 className="report-section-title">Analysis Results</h2>

                {resultGroups && resultGroups.length > 0 ? (
                    resultGroups.map((group, idx) => (
                        <div key={idx} className="report-results-group">
                            <h3 className="report-category-title">{group.categoryName}</h3>
                            <table className="report-results-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: hasMethodColumn ? '24%' : '30%' }}>Parameter</th>
                                        <th style={{ width: '12%', textAlign: 'right' }}>Result</th>
                                        <th style={{ width: '10%' }}>Unit</th>
                                        <th style={{ width: '14%' }}>Rating</th>
                                        <th style={{ width: hasMethodColumn ? '18%' : '25%' }}>Reference Range</th>
                                        {hasMethodColumn && <th style={{ width: '22%' }}>Method</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.items.map((item, i) => {
                                        const interp = getInterpretation(item.param, item.value);
                                        const indicator = interp ? LEVEL_INDICATOR[interp.level] : null;
                                        const isCritical = interp?.level === 'critical';
                                        const isLow = interp?.level === 'low' || interp?.level === 'high';

                                        return (
                                            <tr key={i} className={isCritical ? 'row-critical' : isLow ? 'row-attention' : ''}>
                                                <td className="param-name">{item.name}</td>
                                                <td className="param-value">
                                                    {item.value != null
                                                        ? (isNaN(Number(item.value)) ? item.value : Number(item.value).toFixed(2))
                                                        : '—'}
                                                </td>
                                                <td className="param-unit">{item.unit || ''}</td>
                                                <td className="param-rating">
                                                    {interp ? (
                                                        <span className="rating-badge" style={{ color: indicator.color }}>
                                                            <span className="rating-symbol">{indicator.symbol}</span> {interp.label}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td className="param-ref">{interp?.ref || '—'}</td>
                                                {hasMethodColumn && (
                                                    <td className="param-method">{item.standard || item.method || '—'}</td>
                                                )}
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
                    Results are reported on an oven-dry weight basis unless otherwise indicated.
                </div>

                {/* Approval Trail */}
                {sample?.approvedBy && (
                    <div className="report-approval-trail">
                        <span className="approval-label">Results Approved:</span>
                        <span className="approval-value">{sample.approvedBy}{sample.approvedAt ? ` — ${fmtDate(sample.approvedAt)}` : ''}</span>
                    </div>
                )}

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
