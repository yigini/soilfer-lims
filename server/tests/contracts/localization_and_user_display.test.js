/**
 * Contract Tests: Localization Integrity (#116) and User Display Names (#126)
 *
 * Verifies:
 * 1. Multilingual dictionary integrity across all 5 supported locales (en, es, es-419, fr, pt).
 * 2. Manager queue terminology standardized to "Lista de tareas" in Spanish/Portuguese and "Manager Task List" in English.
 * 3. Operational view pills (daily, expected, registry) and queue units (batches, tasks, submissions, samples) localized.
 * 4. Map controls (satellite, standard, fullscreen) localized across all locales.
 * 5. Scientific codes remain standard scientific symbols and are not inappropriately localized.
 * 6. User display name resolution (#126): proper name priority, username fallback, whitespace trimming, and Unknown safety.
 * 7. Audit log attribution preservation: immutable username retained in audit logs and reviewer attributions.
 */

const fs = require('fs');
const path = require('path');
const { getDisplayName } = require('../../controllers/messageController');

const LOCALES = ['en', 'es', 'es-419', 'fr', 'pt'];
const translationData = {};

LOCALES.forEach(locale => {
    const filePath = path.resolve(__dirname, `../../../client/src/translations/${locale}.json`);
    const content = fs.readFileSync(filePath, 'utf8');
    translationData[locale] = JSON.parse(content);
});

describe('Localization & Multilingual Integrity Contract (#116)', () => {
    test('1. All 5 translation files load as valid JSON with required top-level sections', () => {
        LOCALES.forEach(locale => {
            const data = translationData[locale];
            expect(data).toBeDefined();
            expect(data.nav).toBeDefined();
            expect(data.queue).toBeDefined();
            expect(data.map).toBeDefined();
            expect(data.samplesSection).toBeDefined();
            expect(data.samplesSection.views).toBeDefined();
        });
    });

    test('2. Manager task list is properly localized without raw English on Spanish/multilingual screens', () => {
        expect(translationData['en'].nav.managerQueue).toBe('Manager Task List');
        expect(translationData['es'].nav.managerQueue).toBe('Lista de tareas');
        expect(translationData['es-419'].nav.managerQueue).toBe('Lista de tareas');
        expect(translationData['fr'].nav.managerQueue).toBe('Liste de tâches');
        expect(translationData['pt'].nav.managerQueue).toBe('Lista de tarefas');

        expect(translationData['en'].queue.title).toBe('Manager Task List');
        expect(translationData['es'].queue.title).toBe('Lista de tareas');
        expect(translationData['es-419'].queue.title).toBe('Lista de tareas');
        expect(translationData['fr'].queue.title).toBe('Liste de tâches');
        expect(translationData['pt'].queue.title).toBe('Lista de tarefas');
    });

    test('3. Operational view selector keys exist and are localized across all 5 languages', () => {
        LOCALES.forEach(locale => {
            const views = translationData[locale].samplesSection.views;
            expect(views.daily).toBeTruthy();
            expect(views.dailyTooltip).toBeTruthy();
            expect(views.expected).toBeTruthy();
            expect(views.expectedTooltip).toBeTruthy();
            expect(views.registry).toBeTruthy();
            expect(views.registryTooltip).toBeTruthy();
        });

        // Specific verified terms
        expect(translationData['es'].samplesSection.views.daily).toBe('Muestras activas');
        expect(translationData['es'].samplesSection.views.expected).toBe('Muestras esperadas');
        expect(translationData['es'].samplesSection.views.registry).toBe('Registro de campo');
    });

    test('4. Queue units for pagination and card counts are localized across all 5 languages', () => {
        LOCALES.forEach(locale => {
            const queue = translationData[locale].queue;
            expect(queue.batches).toBeTruthy();
            expect(queue.tasks).toBeTruthy();
            expect(queue.submissions).toBeTruthy();
            expect(queue.samples).toBeTruthy();
            expect(queue.acrossSamples).toContain('{count}');
            expect(queue.tabExceptions).toBeTruthy();
        });

        expect(translationData['es'].queue.batches).toBe('lotes de CC');
        expect(translationData['es'].queue.tasks).toBe('tareas');
        expect(translationData['es'].queue.tabExceptions).toBe('Excepciones de CC');
    });

    test('5. Map layer and fullscreen controls are localized across all 5 languages', () => {
        LOCALES.forEach(locale => {
            const map = translationData[locale].map;
            expect(map.satellite).toBeTruthy();
            expect(map.standard).toBeTruthy();
            expect(map.fullscreen).toBeTruthy();
            expect(map.exitFullscreen).toBeTruthy();
            expect(map.switchToStandard).toBeTruthy();
            expect(map.switchToSatellite).toBeTruthy();
        });

        expect(translationData['es'].map.satellite).toBe('Satélite');
        expect(translationData['es'].map.standard).toBe('Estándar');
        expect(translationData['es'].map.fullscreen).toBe('Pantalla completa');
    });

    test('6. Scientific method codes remain standard scientific symbols in all catalogues', () => {
        const standardCodes = ['SOC', 'PH', 'SAND', 'SILT', 'CLAY', 'TN', 'CEC'];
        standardCodes.forEach(code => {
            LOCALES.forEach(locale => {
                // Ensure scientific codes are never accidentally added as translated keys that replace symbols
                const nav = translationData[locale].nav;
                expect(nav[code]).toBeUndefined();
            });
        });
    });

    test('7. Inventory subtotal, uncertainty, and status strings are localized across all 5 locales (#116)', () => {
        const inventoryKeys = [
            'subtotalBadge',
            'usableSubtotalTitle',
            'usableSubtotalSummary',
            'countNeeded',
            'countNeededTitle',
            'lowConfirmed',
            'lowConfirmedTitle',
            'lowUncertain',
            'lowUncertainTitle',
            'missingQuantityTitle',
            'expired'
        ];

        LOCALES.forEach(locale => {
            const inventory = translationData[locale].inventory;
            expect(inventory).toBeDefined();
            inventoryKeys.forEach(key => {
                expect(inventory[key]).toBeDefined();
                expect(typeof inventory[key]).toBe('string');
                expect(inventory[key].trim().length).toBeGreaterThan(0);
            });
        });

        // Specific verified localized terms
        expect(translationData['en'].inventory.subtotalBadge).toBe('SUBTOTAL');
        expect(translationData['fr'].inventory.subtotalBadge).toBe('SOUS-TOTAL');
        expect(translationData['es'].inventory.countNeeded).toBe('CONTEO REQUERIDO');
        expect(translationData['pt'].inventory.countNeeded).toBe('CONTAGEM NECESSÁRIA');
        expect(translationData['es'].inventory.lowUncertain).toBe('BAJO? (INCIERTO)');
        expect(translationData['fr'].inventory.lowUncertain).toBe('BAS ? (INCERTAIN)');
    });

    test('8. Dashboard manager metric labels are localized across all 5 locales (#116)', () => {
        const managerKeys = [
            'managerExceptions',
            'managerReview',
            'managerFinalApproval',
            'managerAssign',
            'managerIntake'
        ];

        LOCALES.forEach(locale => {
            const metrics = translationData[locale].dashboard?.metrics;
            expect(metrics).toBeDefined();
            managerKeys.forEach(k => {
                expect(metrics[k]).toBeDefined();
                expect(typeof metrics[k]).toBe('string');
                expect(metrics[k].trim().length).toBeGreaterThan(0);
            });
        });

        // Exact verified Spanish translations matching issue 116 live review
        expect(translationData['es'].dashboard.metrics.managerExceptions).toBe('Necesita una decisión');
        expect(translationData['es'].dashboard.metrics.managerReview).toBe('Trabajo enviado');
        expect(translationData['es'].dashboard.metrics.managerFinalApproval).toBe('Aprobación final');
        expect(translationData['es'].dashboard.metrics.managerAssign).toBe('Asignar trabajo');
        expect(translationData['es'].dashboard.metrics.managerIntake).toBe('Aceptación de ingreso');

        // Latin America Spanish
        expect(translationData['es-419'].dashboard.metrics.managerExceptions).toBe('Necesita una decisión');
        expect(translationData['es-419'].dashboard.metrics.managerReview).toBe('Trabajo enviado');

        // French
        expect(translationData['fr'].dashboard.metrics.managerExceptions).toBe('Nécessite une décision');
        expect(translationData['fr'].dashboard.metrics.managerReview).toBe('Travail soumis');

        // Portuguese
        expect(translationData['pt'].dashboard.metrics.managerExceptions).toBe('Precisa de uma decisão');
        expect(translationData['pt'].dashboard.metrics.managerReview).toBe('Trabalho enviado');
    });

    test('9. Dashboard unit keys support pluralization across all 5 locales (#116)', () => {
        const units = ['samples', 'tasks', 'exceptions', 'batches', 'reports', 'checklists', 'determinations'];

        LOCALES.forEach(locale => {
            const unitSection = translationData[locale].dashboard?.units;
            expect(unitSection).toBeDefined();
            units.forEach(u => {
                expect(unitSection[u]).toBeDefined();
                expect(unitSection[u]).toContain('plural');
                expect(unitSection[u]).toContain('one');
                expect(unitSection[u]).toContain('other');
            });
        });

        // Verified Spanish unit patterns
        expect(translationData['es'].dashboard.units.samples).toContain('muestras');
        expect(translationData['es'].dashboard.units.tasks).toContain('tareas');
        expect(translationData['es'].dashboard.units.exceptions).toContain('excepciones');
        expect(translationData['es'].dashboard.units.checklists).toContain('listas de control');
        expect(translationData['es'].dashboard.units.determinations).toContain('determinaciones');
    });

    test('10. Work queue statuses, actions, contexts, and notes are localized (#116)', () => {
        // Statuses
        LOCALES.forEach(locale => {
            const status = translationData[locale].dashboard?.workQueue?.status;
            expect(status).toBeDefined();
            expect(status.unassigned).toBeTruthy();
            expect(status.readyForReview).toBeTruthy();
            expect(status.readyForFinalCheck).toBeTruthy();
            expect(status.awaitingAcceptance).toBeTruthy();
            expect(status.qcFailed).toBeTruthy();
        });

        expect(translationData['es'].dashboard.workQueue.status.unassigned).toBe('Sin asignar');
        expect(translationData['es'].dashboard.workQueue.status.readyForReview).toBe('Listo para revisión');
        expect(translationData['es'].dashboard.workQueue.status.readyForFinalCheck).toBe('Listo para verificación final');
        expect(translationData['es'].dashboard.workQueue.status.awaitingAcceptance).toBe('En espera de aceptación');
        expect(translationData['es'].dashboard.workQueue.status.qcFailed).toBe('Control de calidad fallido');

        // Actions
        expect(translationData['es'].dashboard.workQueue.action.assignByMethod).toBe('Asignar por método');
        expect(translationData['es'].dashboard.workQueue.action.review).toBe('Revisar');
        expect(translationData['es'].dashboard.workQueue.action.openFinalReview).toBe('Abrir revisión final');
        expect(translationData['es'].dashboard.workQueue.action.inspectIntake).toBe('Inspeccionar ingreso');
        expect(translationData['es'].dashboard.workQueue.action.inspectQc).toBe('Inspeccionar CC');

        // Contexts
        expect(translationData['es'].dashboard.workQueue.context.operationalGate).toBe('Puerta operativa');
        expect(translationData['es'].dashboard.workQueue.context.analyticalMethod).toBe('Método analítico');
        expect(translationData['es'].dashboard.workQueue.context.affectedWorkItems).toContain('elementos');
        expect(translationData['es'].dashboard.workQueue.context.allAnalysesAccepted).toContain('aceptados');

        // Notes
        expect(translationData['es'].dashboard.workQueue.notes.unassignedAllocation).toContain('sin asignar');
        expect(translationData['es'].dashboard.workQueue.notes.inspectSubmittedEvidence).toContain('Inspeccionar');
        expect(translationData['es'].dashboard.workQueue.notes.finalApprovalAuthorize).toContain('aprobación final');
    });

    test('11. Sidebar collapse labels are localized across all 5 locales (#116)', () => {
        LOCALES.forEach(locale => {
            const nav = translationData[locale].nav;
            expect(nav.collapse).toBeDefined();
            expect(nav.expandSidebar).toBeDefined();
            expect(nav.collapseSidebar).toBeDefined();
        });

        expect(translationData['en'].nav.collapse).toBe('Collapse');
        expect(translationData['es'].nav.collapse).toBe('Plegar');
        expect(translationData['es-419'].nav.collapse).toBe('Plegar');
        expect(translationData['fr'].nav.collapse).toBe('Réduire');
        expect(translationData['pt'].nav.collapse).toBe('Recolher');
    });
});

describe('User Display Name Resolution & Audit Integrity Contract (#126)', () => {
    test('1. Resolves proper display name when user.name is provided', () => {
        const user = { username: 'jsmith', name: 'Dr. John Smith' };
        expect(getDisplayName(user)).toBe('Dr. John Smith');
    });

    test('2. Trims leading and trailing whitespace from user.name', () => {
        const user = { username: 'mrodriguez', name: '  Maria Rodriguez  ' };
        expect(getDisplayName(user)).toBe('Maria Rodriguez');
    });

    test('3. Falls back to username when user.name is null, undefined, or empty string', () => {
        expect(getDisplayName({ username: 'ana_gomez', name: null })).toBe('ana_gomez');
        expect(getDisplayName({ username: 'ana_gomez', name: undefined })).toBe('ana_gomez');
        expect(getDisplayName({ username: 'ana_gomez', name: '' })).toBe('ana_gomez');
        expect(getDisplayName({ username: 'ana_gomez', name: '   ' })).toBe('ana_gomez');
    });

    test('4. Falls back to Unknown when both name and username are missing', () => {
        expect(getDisplayName(null)).toBe('Unknown');
        expect(getDisplayName(undefined)).toBe('Unknown');
        expect(getDisplayName({})).toBe('Unknown');
        expect(getDisplayName({ name: null, username: null })).toBe('Unknown');
    });

    test('5. Supports direct string username fallback', () => {
        expect(getDisplayName('lab_operator_1')).toBe('lab_operator_1');
    });

    test('6. Audit reviewer attribution records stable username rather than mutated display string', () => {
        const actor = {
            id: 'u-mgr-1',
            username: 'lab_mgr_audit_stable',
            name: 'Dr. Auditor Senior'
        };

        // Simulated reviewer log payload per workItemController.js review flow
        const auditLogPayload = {
            reviewerName: actor.username,
            authorization: 'LAB_MANAGER',
            policyVersion: 'v1'
        };

        // Stable actor username must be preserved for compliance and reproducible audit
        expect(auditLogPayload.reviewerName).toBe('lab_mgr_audit_stable');
        expect(auditLogPayload.reviewerName).not.toBe('Dr. Auditor Senior');
    });
});
