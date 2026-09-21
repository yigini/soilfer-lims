/**
 * Dynamic role configuration dictionary generator for all 10 canonical roles.
 * Provides explicit localized eyebrow, title, subtitle, primary action, shift notes, and deep-link shortcuts.
 *
 * For LAB_MANAGER, provides title 'Laboratory overview' rather than 'Manager queue' per issue #107.
 */
export function getRoleConfig(role, t = (k, d) => d) {
    const configs = {
        SAMPLE_RECEPTION: {
            eyebrow: t('dashboard.roles.sampleReception.eyebrow', 'Laboratory intake'),
            title: t('dashboard.roles.sampleReception.title', 'Sample reception desk'),
            subtitle: t('dashboard.roles.sampleReception.subtitle', 'Physical intake, custody verification, label generation, and specimen registration.'),
            primaryAction: {
                label: t('dashboard.roles.sampleReception.primaryAction', 'Receive incoming shipment'),
                route: '/reception'
            },
            shiftNotes: {
                title: t('dashboard.roles.sampleReception.shiftNotesTitle', 'Intake & Reception Policy'),
                items: [
                    t('dashboard.roles.sampleReception.shiftNotesItem1', 'Verify container seal integrity and physical custody form before accepting samples.'),
                    t('dashboard.roles.sampleReception.shiftNotesItem2', 'Expected field arrivals are not laboratory work until physically intaken.'),
                    t('dashboard.roles.sampleReception.shiftNotesItem3', 'Drying and preparation gates become active after physical acceptance.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.sampleReception.shortcut1Label', 'Sample intake desk'),
                    route: '/reception',
                    description: t('dashboard.roles.sampleReception.shortcut1Desc', 'Register received shipments and print labels')
                },
                {
                    label: t('dashboard.roles.sampleReception.shortcut2Label', 'Sample registry'),
                    route: '/samples',
                    description: t('dashboard.roles.sampleReception.shortcut2Desc', 'Search and inspect all intaken specimens')
                },
                {
                    label: t('dashboard.roles.sampleReception.shortcut3Label', 'Consumables inventory'),
                    route: '/inventory',
                    description: t('dashboard.roles.sampleReception.shortcut3Desc', 'Check sampling bags and intake supplies')
                }
            ]
        },
        LAB_TECHNICIAN: {
            eyebrow: t('dashboard.roles.labTechnician.eyebrow', 'Analytical bench'),
            title: t('dashboard.roles.labTechnician.title', 'Analytical workbench'),
            subtitle: t('dashboard.roles.labTechnician.subtitle', 'Method queues, batch runs, calibration verification, and instrument measurement entry.'),
            primaryAction: {
                label: t('dashboard.roles.labTechnician.primaryAction', 'Open analytical workbench'),
                route: '/workbench'
            },
            shiftNotes: {
                title: t('dashboard.roles.labTechnician.shiftNotesTitle', 'Bench Work Instructions'),
                items: [
                    t('dashboard.roles.labTechnician.shiftNotesItem1', 'Check instrument qualification and calibration status before initiating analytical runs.'),
                    t('dashboard.roles.labTechnician.shiftNotesItem2', 'Determinations are batched up to 40 samples per run with required QC controls.'),
                    t('dashboard.roles.labTechnician.shiftNotesItem3', 'Complete drying and preparation checklists before recording wet chemistry results.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.labTechnician.shortcut1Label', 'Bench measurement workbench'),
                    route: '/workbench',
                    description: t('dashboard.roles.labTechnician.shortcut1Desc', 'Record determinations and review QC')
                },
                {
                    label: t('dashboard.roles.labTechnician.shortcut2Label', 'Assigned tasks (My Work)'),
                    route: '/my-work',
                    description: t('dashboard.roles.labTechnician.shortcut2Desc', 'View individual assigned analyses')
                },
                {
                    label: t('dashboard.roles.labTechnician.shortcut3Label', 'Laboratory equipment'),
                    route: '/equipment',
                    description: t('dashboard.roles.labTechnician.shortcut3Desc', 'Inspect instrument status and calibration dates')
                },
                {
                    label: t('dashboard.roles.labTechnician.shortcut4Label', 'Chemicals & Reagents'),
                    route: '/inventory',
                    description: t('dashboard.roles.labTechnician.shortcut4Desc', 'Check standards and solution lots')
                }
            ]
        },
        LAB_MANAGER: {
            eyebrow: t('dashboard.roles.labManager.eyebrow', 'Laboratory management'),
            title: t('dashboard.roles.labManager.title', 'Laboratory overview'),
            subtitle: t('dashboard.roles.labManager.subtitle', 'Intake approval, analytical assignment, submission review, and final result authorization.'),
            primaryAction: {
                label: t('dashboard.roles.labManager.primaryAction', 'Open manager task list'),
                route: '/manager-queue'
            },
            shiftNotes: {
                title: t('dashboard.roles.labManager.shiftNotesTitle', 'Manager Oversight & Review'),
                items: [
                    t('dashboard.roles.labManager.shiftNotesItem1', 'Review QC batch control charts before accepting analytical submissions.'),
                    t('dashboard.roles.labManager.shiftNotesItem2', 'Final sample approval requires all ordered work accepted and valid evidence.'),
                    t('dashboard.roles.labManager.shiftNotesItem3', 'All-omitted orders require explicit administrative closure, not normal result approval.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.labManager.shortcut1Label', 'Manager task list'),
                    route: '/manager-queue',
                    description: t('dashboard.roles.labManager.shortcut1Desc', 'Review and approve pending work items')
                },
                {
                    label: t('dashboard.roles.labManager.shortcut2Label', 'All laboratory samples'),
                    route: '/samples',
                    description: t('dashboard.roles.labManager.shortcut2Desc', 'Inspect sample progress and history')
                },
                {
                    label: t('dashboard.roles.labManager.shortcut3Label', 'Staff & Authorizations'),
                    route: '/users',
                    description: t('dashboard.roles.labManager.shortcut3Desc', 'Manage operator assignments and permissions')
                },
                {
                    label: t('dashboard.roles.labManager.shortcut4Label', 'Official reports'),
                    route: '/result-reports',
                    description: t('dashboard.roles.labManager.shortcut4Desc', 'Generate and publish analytical reports')
                }
            ]
        },
        MASTER_USER: {
            eyebrow: t('dashboard.roles.masterUser.eyebrow', 'National program oversight'),
            title: t('dashboard.roles.masterUser.title', 'National master overview'),
            subtitle: t('dashboard.roles.masterUser.subtitle', 'Cross-laboratory quality coordination, analytical throughput, and national program progress.'),
            primaryAction: {
                label: t('dashboard.roles.masterUser.primaryAction', 'View released reports'),
                route: '/result-reports'
            },
            shiftNotes: {
                title: t('dashboard.roles.masterUser.shiftNotesTitle', 'National Program Guidance'),
                items: [
                    t('dashboard.roles.masterUser.shiftNotesItem1', 'Oversees national laboratory network performance and QC exceptions.'),
                    t('dashboard.roles.masterUser.shiftNotesItem2', 'Switch laboratory scope using the selector above to inspect specific lab queues.'),
                    t('dashboard.roles.masterUser.shiftNotesItem3', 'Approved results must be published as official reports before external stakeholder release.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.masterUser.shortcut1Label', 'Laboratory network'),
                    route: '/admin/labs',
                    description: t('dashboard.roles.masterUser.shortcut1Desc', 'Inspect national laboratory facilities')
                },
                {
                    label: t('dashboard.roles.masterUser.shortcut2Label', 'Published reports'),
                    route: '/result-reports',
                    description: t('dashboard.roles.masterUser.shortcut2Desc', 'Search and download released certificates')
                },
                {
                    label: t('dashboard.roles.masterUser.shortcut3Label', 'Project tracking'),
                    route: '/projects',
                    description: t('dashboard.roles.masterUser.shortcut3Desc', 'Monitor project sampling and throughput')
                }
            ]
        },
        PROJECT_MANAGER: {
            eyebrow: t('dashboard.roles.projectManager.eyebrow', 'Project coordination'),
            title: t('dashboard.roles.projectManager.title', 'Project sample portfolio'),
            subtitle: t('dashboard.roles.projectManager.subtitle', 'Sample progress, analytical completion rates, and geospatial tracking for assigned projects.'),
            primaryAction: {
                label: t('dashboard.roles.projectManager.primaryAction', 'View project portfolio'),
                route: '/projects'
            },
            shiftNotes: {
                title: t('dashboard.roles.projectManager.shiftNotesTitle', 'Project Coordination Protocol'),
                items: [
                    t('dashboard.roles.projectManager.shiftNotesItem1', 'Monitors field sample progression across participating laboratories.'),
                    t('dashboard.roles.projectManager.shiftNotesItem2', 'Data results and spatial distributions are available once analytical work is accepted.'),
                    t('dashboard.roles.projectManager.shiftNotesItem3', 'Official reports can be distributed to stakeholders once published.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.projectManager.shortcut1Label', 'Project overview'),
                    route: '/projects',
                    description: t('dashboard.roles.projectManager.shortcut1Desc', 'Track sample milestones and delivery')
                },
                {
                    label: t('dashboard.roles.projectManager.shortcut2Label', 'Analytical results table'),
                    route: '/data-results',
                    description: t('dashboard.roles.projectManager.shortcut2Desc', 'Explore tabular soil data')
                },
                {
                    label: t('dashboard.roles.projectManager.shortcut3Label', 'Result reports'),
                    route: '/result-reports',
                    description: t('dashboard.roles.projectManager.shortcut3Desc', 'Browse and download published reports')
                }
            ]
        },
        AUDIT_USER: {
            eyebrow: t('dashboard.roles.auditUser.eyebrow', 'Quality assurance & audit'),
            title: t('dashboard.roles.auditUser.title', 'Quality & audit overview'),
            subtitle: t('dashboard.roles.auditUser.subtitle', 'Read-only quality assurance, result auditing, and regulatory compliance inspection.'),
            primaryAction: {
                label: t('dashboard.roles.auditUser.primaryAction', 'Inspect audit log'),
                route: '/admin/audit'
            },
            shiftNotes: {
                title: t('dashboard.roles.auditUser.shiftNotesTitle', 'Audit & Compliance Guidelines'),
                items: [
                    t('dashboard.roles.auditUser.shiftNotesItem1', 'Audit users maintain read-only inspection authority across quality records.'),
                    t('dashboard.roles.auditUser.shiftNotesItem2', 'Report publication and result modifications are strictly restricted to managers.'),
                    t('dashboard.roles.auditUser.shiftNotesItem3', 'Traceable amendment logs record all post-intake and post-approval adjustments.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.auditUser.shortcut1Label', 'System audit trail'),
                    route: '/admin/audit',
                    description: t('dashboard.roles.auditUser.shortcut1Desc', 'Inspect immutable system events and changes')
                },
                {
                    label: t('dashboard.roles.auditUser.shortcut2Label', 'Quality assurance view'),
                    route: '/qa',
                    description: t('dashboard.roles.auditUser.shortcut2Desc', 'View QC exception queues and batch dispositions')
                },
                {
                    label: t('dashboard.roles.auditUser.shortcut3Label', 'Sample dossiers'),
                    route: '/samples',
                    description: t('dashboard.roles.auditUser.shortcut3Desc', 'Inspect complete sample custody and analytical logs')
                }
            ]
        },
        SURVEYOR: {
            eyebrow: t('dashboard.roles.surveyor.eyebrow', 'Field operations'),
            title: t('dashboard.roles.surveyor.title', 'Field sample registration'),
            subtitle: t('dashboard.roles.surveyor.subtitle', 'Field sample collection tracking, GPS coordinates, and handover custody.'),
            primaryAction: {
                label: t('dashboard.roles.surveyor.primaryAction', 'Inspect registered samples'),
                route: '/samples'
            },
            shiftNotes: {
                title: t('dashboard.roles.surveyor.shiftNotesTitle', 'Field Sampling Instructions'),
                items: [
                    t('dashboard.roles.surveyor.shiftNotesItem1', 'Ensure field GPS coordinates are recorded for each collected soil specimen.'),
                    t('dashboard.roles.surveyor.shiftNotesItem2', 'Generate custody dispatch notes when handing shipments to laboratory transport.'),
                    t('dashboard.roles.surveyor.shiftNotesItem3', 'Samples remain in EXPECTED arrival status until physically received at the laboratory.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.surveyor.shortcut1Label', 'My collected samples'),
                    route: '/samples',
                    description: t('dashboard.roles.surveyor.shortcut1Desc', 'Track provenance and arrival status')
                },
                {
                    label: t('dashboard.roles.surveyor.shortcut2Label', 'Field sampling map'),
                    route: '/maps',
                    description: t('dashboard.roles.surveyor.shortcut2Desc', 'Inspect geographic distribution of sampling sites')
                }
            ]
        },
        EXTERNAL_VIEWER: {
            eyebrow: t('dashboard.roles.externalViewer.eyebrow', 'Stakeholder portal'),
            title: t('dashboard.roles.externalViewer.title', 'Partner data & reports'),
            subtitle: t('dashboard.roles.externalViewer.subtitle', 'Authorized access to published laboratory result reports and verified project datasets.'),
            primaryAction: {
                label: t('dashboard.roles.externalViewer.primaryAction', 'Browse published reports'),
                route: '/result-reports'
            },
            shiftNotes: {
                title: t('dashboard.roles.externalViewer.shiftNotesTitle', 'Partner Access Policy'),
                items: [
                    t('dashboard.roles.externalViewer.shiftNotesItem1', 'Access is restricted to finalized, published laboratory certificates.'),
                    t('dashboard.roles.externalViewer.shiftNotesItem2', 'Internal draft analyses, operator notes, and raw spectra are excluded from view.'),
                    t('dashboard.roles.externalViewer.shiftNotesItem3', 'Published reports carry monotonic versioning and authorized electronic approval records.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.externalViewer.shortcut1Label', 'Official reports'),
                    route: '/result-reports',
                    description: t('dashboard.roles.externalViewer.shortcut1Desc', 'Download verified soil test certificates')
                },
                {
                    label: t('dashboard.roles.externalViewer.shortcut2Label', 'About SoilFER'),
                    route: '/about',
                    description: t('dashboard.roles.externalViewer.shortcut2Desc', 'Read about project standards and methodologies')
                }
            ]
        },
        VIEWER: {
            eyebrow: t('dashboard.roles.viewer.eyebrow', 'General viewer'),
            title: t('dashboard.roles.viewer.title', 'Laboratory progress viewer'),
            subtitle: t('dashboard.roles.viewer.subtitle', 'Read-only overview of completed analyses and published reports.'),
            primaryAction: {
                label: t('dashboard.roles.viewer.primaryAction', 'View published reports'),
                route: '/result-reports'
            },
            shiftNotes: {
                title: t('dashboard.roles.viewer.shiftNotesTitle', 'Viewer Guidelines'),
                items: [
                    t('dashboard.roles.viewer.shiftNotesItem1', 'Read-only access to published laboratory output.'),
                    t('dashboard.roles.viewer.shiftNotesItem2', 'Operational actions and result edits require elevated role authorization.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.viewer.shortcut1Label', 'Published reports'),
                    route: '/result-reports',
                    description: t('dashboard.roles.viewer.shortcut1Desc', 'Search released soil certificates')
                },
                {
                    label: t('dashboard.roles.viewer.shortcut2Label', 'Sample tracking'),
                    route: '/samples',
                    description: t('dashboard.roles.viewer.shortcut2Desc', 'View sample progress states')
                }
            ]
        },
        SUPER_ADMIN: {
            eyebrow: t('dashboard.roles.superAdmin.eyebrow', 'System administration'),
            title: t('dashboard.roles.superAdmin.title', 'System administrator dashboard'),
            subtitle: t('dashboard.roles.superAdmin.subtitle', 'Global laboratory network configuration, user access governance, and operational integrity.'),
            primaryAction: {
                label: t('dashboard.roles.superAdmin.primaryAction', 'Laboratory facilities'),
                route: '/admin/labs'
            },
            shiftNotes: {
                title: t('dashboard.roles.superAdmin.shiftNotesTitle', 'System Administration Governance'),
                items: [
                    t('dashboard.roles.superAdmin.shiftNotesItem1', 'Global system administration spans all registered national laboratories.'),
                    t('dashboard.roles.superAdmin.shiftNotesItem2', 'Switch active laboratory above to inspect facility-specific queues and workloads.'),
                    t('dashboard.roles.superAdmin.shiftNotesItem3', 'Security pragmas enforce WAL mode, busy timeout, and foreign key integrity.')
                ]
            },
            shortcuts: [
                {
                    label: t('dashboard.roles.superAdmin.shortcut1Label', 'Laboratory management'),
                    route: '/admin/labs',
                    description: t('dashboard.roles.superAdmin.shortcut1Desc', 'Manage national lab facilities')
                },
                {
                    label: t('dashboard.roles.superAdmin.shortcut2Label', 'Methodologies & SOPs'),
                    route: '/admin/methods',
                    description: t('dashboard.roles.superAdmin.shortcut2Desc', 'Configure analytical methods')
                },
                {
                    label: t('dashboard.roles.superAdmin.shortcut3Label', 'User accounts'),
                    route: '/users',
                    description: t('dashboard.roles.superAdmin.shortcut3Desc', 'Manage user credentials and role grants')
                },
                {
                    label: t('dashboard.roles.superAdmin.shortcut4Label', 'Audit log'),
                    route: '/admin/audit',
                    description: t('dashboard.roles.superAdmin.shortcut4Desc', 'Review immutable security event logs')
                }
            ]
        }
    };

    return configs[role] || null;
}
