import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function LabsAndPeopleTab({
    project,
    labAccess,
    capabilities = {},
    userRole = '',
    onOpenManageLabs
}) {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const memberLabs = labAccess?.memberLabs || [];
    const canManageAccess = Boolean(capabilities.canManageAccess);

    return (
        <div className="space-y-6">
            {/* Scope Disclaimer */}
            <div className="p-4 rounded-xl border border-sf-divider bg-sf-inset text-xs text-sf-muted">
                {capabilities.isScopedOnly
                    ? t('projects.team.scopedNotice', 'You are viewing your laboratory’s participation. Other laboratories’ staff and internal sample details are isolated.')
                    : t('projects.team.wholeNotice', 'Owner and servicing memberships are canonical and explicit. Country-level assignment never automatically grants laboratory data access.')}
            </div>

            {/* Participating Labs Card */}
            <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h2 className="text-lg font-bold text-sf-text">
                            {t('projects.team.participatingLabsTitle', 'Laboratories and responsibilities')}
                        </h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            {t('projects.team.participatingLabsSubtitle', 'All authorized analytical facilities registered to this project.')}
                        </p>
                    </div>

                    {canManageAccess && onOpenManageLabs && (
                        <button
                            onClick={onOpenManageLabs}
                            className="text-xs font-semibold px-3 py-2 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-text transition-colors self-start sm:self-auto"
                        >
                            {t('projects.team.reviewLabAccess', 'Review lab access')}
                        </button>
                    )}
                </div>

                {/* Laboratories Table */}
                <div className="overflow-x-auto rounded-xl border border-sf-divider">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-sf-inset border-b border-sf-divider text-sf-muted uppercase tracking-wider font-semibold text-[11px]">
                                <th className="py-3 px-4">{t('projects.team.labHeader', 'Laboratory')}</th>
                                <th className="py-3 px-4">{t('projects.team.roleHeader', 'Responsibility')}</th>
                                <th className="py-3 px-4">{t('projects.team.statusHeader', 'Operational Status')}</th>
                                <th className="py-3 px-4">{t('projects.team.scopeHeader', 'Scope')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sf-divider/70">
                            {memberLabs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-6 text-center text-sf-muted">
                                        {project?.labId ? (
                                            <span>
                                                {t('projects.team.ownerLabOnly', { lab: project.labId }, 'Primary Coordinating Lab: {{lab}}')}
                                            </span>
                                        ) : (
                                            <span>{t('projects.team.noLabsAssigned', 'No servicing laboratories explicitly assigned.')}</span>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                memberLabs.map((lab) => {
                                    const isOwner = lab.id === project?.labId;
                                    return (
                                        <tr key={lab.id} className="hover:bg-sf-hover/40 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-sf-text">{lab.name || lab.code || lab.id}</div>
                                                <div className="text-[11px] text-sf-muted font-mono">{lab.code || lab.id} · {lab.country || '—'}</div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                                    isOwner
                                                        ? 'bg-sf-primary/10 text-sf-primary border border-sf-primary/20'
                                                        : 'bg-sf-inset text-sf-text border border-sf-divider'
                                                }`}>
                                                    {isOwner ? t('projects.team.coordinatingOwner', 'Coordinating owner') : t('projects.team.servicingLab', 'Servicing laboratory')}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {lab.isActive !== false ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300">
                                                        {t('projects.team.activeStatus', 'Active')}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300">
                                                        {t('projects.team.inactiveStatus', 'Inactive / Unavailable')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sf-muted">
                                                {isOwner ? t('projects.team.projectCoordination', 'Project coordination') : t('projects.team.ownLabWork', 'Own-lab work')}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Split Cards: Staffing & Access Rules */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-4">
                    <h3 className="text-sm font-bold text-sf-text">
                        {t('projects.team.staffingTitle', 'Staffing overview')}
                    </h3>
                    <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.team.sampleReception', 'Sample Reception & Intake')}</span>
                            <span className="font-semibold text-sf-text">{t('projects.team.activeStaff', 'Authorized staff')}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.team.analysts', 'Laboratory Analysts & Techs')}</span>
                            <span className="font-semibold text-sf-text">{t('projects.team.activeStaff', 'Authorized staff')}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-sf-divider">
                            <span className="text-sf-muted">{t('projects.team.managers', 'Quality & Approving Managers')}</span>
                            <span className="font-semibold text-sf-text">{t('projects.team.activeStaff', 'Authorized staff')}</span>
                        </div>
                    </div>
                    <p className="text-xs text-sf-muted">
                        {t('projects.team.staffingDesc', 'Staff permissions are inherited from their assigned laboratory and role in the central staff directory.')}
                    </p>
                    <button
                        onClick={() => navigate('/users')}
                        className="text-xs font-semibold text-sf-primary hover:underline flex items-center gap-1 pt-1"
                    >
                        <span>{t('projects.team.manageStaffLink', 'View authorized team contacts →')}</span>
                    </button>
                </div>

                <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-4">
                    <h3 className="text-sm font-bold text-sf-text">
                        {t('projects.team.membershipAllowsTitle', 'What this membership allows')}
                    </h3>
                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('projects.team.membershipAllowsDesc', 'Servicing staff can receive, prepare, measure, and review assigned samples for their laboratory. Project membership does not grant permission to edit user roles, approve unsubmitted results, or administer other laboratories.')}
                    </p>
                    <div className="p-3.5 rounded-xl border border-sf-divider bg-sf-inset text-xs text-sf-muted">
                        <strong className="text-sf-text font-semibold block mb-0.5">
                            {t('projects.team.safeRemovalNotice', 'Safe laboratory removal')}
                        </strong>
                        {t('projects.team.safeRemovalDesc', 'A laboratory cannot be removed while active samples or unreviewed results require an accountable facility.')}
                    </div>
                </div>
            </div>
        </div>
    );
}
