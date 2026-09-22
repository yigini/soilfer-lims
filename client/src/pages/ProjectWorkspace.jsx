import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

import WorkspaceHeader from '../components/projects/WorkspaceHeader';
import OverviewTab from '../components/projects/OverviewTab';
import SamplesTab from '../components/projects/SamplesTab';
import AnalysisPlanTab from '../components/projects/AnalysisPlanTab';
import LabsAndPeopleTab from '../components/projects/LabsAndPeopleTab';
import DataConnectionsTab from '../components/projects/DataConnectionsTab';
import ActivityTab from '../components/projects/ActivityTab';

import ProjectActionsModal from '../components/projects/ProjectActionsModal';
import ImportPreviewModal from '../components/projects/ImportPreviewModal';
import PageGuideModal from '../components/projects/PageGuideModal';

export default function ProjectWorkspace() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [project, setProject] = useState(null);
    const [stats, setStats] = useState(null);
    const [samples, setSamples] = useState([]);
    const [samplesTotal, setSamplesTotal] = useState(0);
    const [samplesLoading, setSamplesLoading] = useState(false);
    const [samplesError, setSamplesError] = useState(null);
    const [labAccess, setLabAccess] = useState(null);
    const [koboConfig, setKoboConfig] = useState(null);

    const activeTab = searchParams.get('tab') || 'overview';
    const selectedStage = searchParams.get('stage') || 'all';
    const searchQuery = searchParams.get('q') || '';
    const samplesPage = parseInt(searchParams.get('page'), 10) || 1;
    const samplesLimit = parseInt(searchParams.get('limit'), 10) || 50;

    const [loading, setLoading] = useState(true);
    const [errorState, setErrorState] = useState(null);

    // Modals
    const [actionsModalOpen, setActionsModalOpen] = useState(false);
    const [actionsModalInitialAction, setActionsModalInitialAction] = useState('menu');
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [guideModalOpen, setGuideModalOpen] = useState(false);

    const abortControllerRef = React.useRef(null);

    const setActiveTab = (tab) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);
            return next;
        });
    };

    const setSelectedStage = (stage) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (stage && stage !== 'all') {
                next.set('stage', stage);
            } else {
                next.delete('stage');
            }
            next.set('page', '1');
            return next;
        });
    };

    const setSearchQuery = (q) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (q && q.trim()) {
                next.set('q', q.trim());
            } else {
                next.delete('q');
            }
            next.set('page', '1');
            return next;
        });
    };

    const handleClearFilters = () => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('q');
            next.delete('stage');
            next.set('page', '1');
            return next;
        });
    };

    const handleOpenActionsModal = (action = 'menu') => {
        setActionsModalInitialAction(action);
        setActionsModalOpen(true);
    };

    const setSamplesPage = (page) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('page', String(page));
            return next;
        });
    };

    const setSamplesLimit = (limit) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('limit', String(limit));
            next.set('page', '1');
            return next;
        });
    };

    const fetchSamples = useCallback(async (page = 1, limit = 50, q = '', stage = 'all') => {
        if (!projectId) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setSamplesLoading(true);
        setSamplesError(null);
        try {
            const params = { page, limit };
            if (q && q.trim()) params.q = q.trim();
            if (stage && stage !== 'all') params.stage = stage;

            const samplesRes = await axios.get(`/api/projects/${projectId}/samples`, {
                params,
                signal: abortControllerRef.current.signal
            });
            setSamples(Array.isArray(samplesRes.data) ? samplesRes.data : []);
            const headerTotal = parseInt(samplesRes.headers['x-total-count'], 10);
            if (!isNaN(headerTotal)) {
                setSamplesTotal(headerTotal);
            }
        } catch (err) {
            if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError') {
                return;
            }
            console.warn('[Workspace] Samples fetch failed:', err.message);
            setSamplesError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load samples');
        } finally {
            setSamplesLoading(false);
        }
    }, [projectId]);

    const fetchWorkspaceData = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        setErrorState(null);

        try {
            // 1. Project details (with capabilities)
            const projRes = await axios.get(`/api/projects/${projectId}`);
            const projData = projRes.data;
            setProject(projData);

            // 2. Stats & Truthful counts
            try {
                const statsRes = await axios.get(`/api/projects/${projectId}/stats`);
                setStats(statsRes.data);
            } catch (err) {
                console.warn('[Workspace] Stats fetch failed:', err.message);
            }

            // 3. Scoped samples
            await fetchSamples(samplesPage, samplesLimit, searchQuery, selectedStage);

            // 4. Lab Access & Membership
            try {
                const accessRes = await axios.get(`/api/projects/${projectId}/lab-access`);
                setLabAccess(accessRes.data);
            } catch (err) {
                console.warn('[Workspace] Lab access fetch failed:', err.message);
            }

            // 5. Kobo config
            try {
                const koboRes = await axios.get(`/api/projects/${projectId}/kobo-config`);
                setKoboConfig(koboRes.data);
            } catch (err) {
                console.warn('[Workspace] Kobo config fetch failed:', err.message);
            }
        } catch (err) {
            console.error('[Workspace] Fatal error loading project:', err);
            const status = err.response?.status;
            if (status === 403) {
                setErrorState({
                    code: 'FORBIDDEN',
                    message: t('projects.errors.accessDenied', 'Access denied: You do not have permission to view this project.')
                });
            } else if (status === 404) {
                setErrorState({
                    code: 'NOT_FOUND',
                    message: t('projects.errors.notFound', 'Project not found or was moved to trash.')
                });
            } else {
                setErrorState({
                    code: 'SERVER_ERROR',
                    message: t('projects.errors.serverError', 'Failed to load project details.')
                });
            }
        } finally {
            setLoading(false);
        }
    }, [projectId, t]);

    useEffect(() => {
        fetchWorkspaceData();
    }, [fetchWorkspaceData]);

    const isInitialMount = React.useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        fetchSamples(samplesPage, samplesLimit, searchQuery, selectedStage);
    }, [fetchSamples, samplesPage, samplesLimit, searchQuery, selectedStage]);

    const handleSelectStage = (stageIdx) => {
        setSelectedStage(stageIdx);
        setActiveTab('samples');
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh] space-y-3">
                <RefreshCw className="w-8 h-8 text-sf-primary animate-spin" />
                <p className="text-xs text-sf-muted font-medium">
                    {t('common.loading', 'Loading project workspace…')}
                </p>
            </div>
        );
    }

    if (errorState) {
        return (
            <div className="max-w-xl mx-auto p-6 mt-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-bold text-sf-text">
                    {errorState.code === 'FORBIDDEN' ? t('projects.errors.forbiddenTitle', 'Access Denied') : t('projects.errors.errorTitle', 'Project Unavailable')}
                </h1>
                <p className="text-xs text-sf-muted max-w-sm mx-auto">
                    {errorState.message}
                </p>
                <div className="pt-2">
                    <button
                        onClick={() => navigate('/projects')}
                        className="btn-primary text-xs inline-flex items-center gap-1.5"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>{t('projects.errors.returnToList', 'Return to projects overview')}</span>
                    </button>
                </div>
            </div>
        );
    }

    const counts = stats?.counts || {
        registered: samples.length,
        awaitingArrival: 0,
        intakeInProgress: 0,
        labWork: 0,
        awaitingReview: 0,
        released: 0,
        rejectedOrCancelled: 0,
        needsReconciliation: 0,
        everPhysicallyReceived: 0
    };

    const capabilities = {
        canManage: Boolean(project?.capabilities?.canEditPlan || project?.capabilities?.canManageAccess || project?.capabilities?.canTransition),
        canEditPlan: Boolean(project?.capabilities?.canEditPlan),
        canManageAccess: Boolean(project?.capabilities?.canManageAccess),
        canManageConnections: Boolean(project?.capabilities?.canManageConnections),
        canTransition: Boolean(project?.capabilities?.canTransition),
        canImport: Boolean(project?.capabilities?.canImport),
        canAuthorizeException: Boolean(project?.capabilities?.canAuthorizeException),
        isScopedOnly: !['SUPER_ADMIN', 'ADMIN', 'MASTER_USER'].includes(user?.role) && Boolean(user?.labId)
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header with Breadcrumb & 6 Tabs */}
            <WorkspaceHeader
                project={project}
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                onOpenGuide={() => setGuideModalOpen(true)}
                onOpenActions={() => handleOpenActionsModal('menu')}
                capabilities={capabilities}
                userRole={user?.role}
            />

            {/* Tab Body */}
            <main>
                {activeTab === 'overview' && (
                    <OverviewTab
                        project={project}
                        counts={counts}
                        stats={stats}
                        onSelectStage={handleSelectStage}
                        onSelectTab={setActiveTab}
                        capabilities={capabilities}
                        userRole={user?.role}
                    />
                )}

                {activeTab === 'samples' && (
                    <SamplesTab
                        project={project}
                        samples={samples}
                        selectedStage={selectedStage}
                        onSelectStage={setSelectedStage}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onClearFilters={handleClearFilters}
                        counts={counts}
                        capabilities={capabilities}
                        page={samplesPage}
                        limit={samplesLimit}
                        totalCount={samplesTotal}
                        onPageChange={setSamplesPage}
                        onLimitChange={(newLimit) => {
                            setSamplesLimit(newLimit);
                            setSamplesPage(1);
                        }}
                        loading={samplesLoading}
                        error={samplesError}
                        onRetry={() => fetchSamples(samplesPage, samplesLimit, searchQuery, selectedStage)}
                    />
                )}

                {activeTab === 'plan' && (
                    <AnalysisPlanTab
                        project={project}
                        capabilities={capabilities}
                        userRole={user?.role}
                        onOpenConfigurePlan={() => handleOpenActionsModal('edit')}
                    />
                )}

                {activeTab === 'team' && (
                    <LabsAndPeopleTab
                        project={project}
                        labAccess={labAccess}
                        capabilities={capabilities}
                        userRole={user?.role}
                        onOpenManageLabs={() => handleOpenActionsModal('lab-access')}
                    />
                )}

                {activeTab === 'connections' && (
                    <DataConnectionsTab
                        project={project}
                        koboConfig={koboConfig}
                        onOpenImportPreview={() => setImportModalOpen(true)}
                        capabilities={capabilities}
                        userRole={user?.role}
                    />
                )}

                {activeTab === 'activity' && (
                    <ActivityTab
                        project={project}
                        capabilities={capabilities}
                        userRole={user?.role}
                    />
                )}
            </main>

            {/* Modals */}
            <ProjectActionsModal
                isOpen={actionsModalOpen}
                onClose={() => setActionsModalOpen(false)}
                project={project}
                counts={counts}
                capabilities={capabilities}
                initialActionType={actionsModalInitialAction}
                onSuccess={() => fetchWorkspaceData()}
            />

            <ImportPreviewModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                project={project}
                onSuccess={() => fetchWorkspaceData()}
            />

            <PageGuideModal
                isOpen={guideModalOpen}
                onClose={() => setGuideModalOpen(false)}
            />
        </div>
    );
}
