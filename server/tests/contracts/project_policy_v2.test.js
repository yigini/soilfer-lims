'use strict';

const projectPolicyService = require('../../services/projectPolicyService');

describe('projectPolicyService - Templates, Admission & Capabilities', () => {
    describe('getEffectiveTemplate & isSoilFerTemplate', () => {
        test('identifies SOILFER_V1 by projectType or code prefix', () => {
            expect(projectPolicyService.getEffectiveTemplate({ code: 'SOILFER-GTM', projectType: 'SOILFER_V1' })).toBe('SOILFER_V1');
            expect(projectPolicyService.getEffectiveTemplate({ code: 'SOILFER-COMPARISON', projectType: 'OPEN_INTAKE' })).toBe('GENERIC_OPEN_INTAKE');
            expect(projectPolicyService.getEffectiveTemplate({ code: 'SOILFER-US', projectType: 'OPEN_INTAKE' })).toBe('GENERIC_OPEN_INTAKE');
            expect(projectPolicyService.getEffectiveTemplate('SOILFER-HND')).toBe('SOILFER_V1');
            expect(projectPolicyService.isSoilFerTemplate('SOILFER-KEN')).toBe(true);
            expect(projectPolicyService.isSoilFerTemplate({ code: 'SOILFER-ZMB' })).toBe(true);
        });

        test('identifies GENERIC_KOBO for KOBO_LINKED projects without SoilFER in code', () => {
            expect(projectPolicyService.getEffectiveTemplate({ code: 'WATERSHED-2026', projectType: 'KOBO_LINKED' })).toBe('GENERIC_KOBO');
            expect(projectPolicyService.isSoilFerTemplate({ code: 'WATERSHED-2026', projectType: 'KOBO_LINKED' })).toBe(false);
        });

        test('identifies GENERIC_MANIFEST for PREDEFINED_MANIFEST projects', () => {
            expect(projectPolicyService.getEffectiveTemplate({ code: 'MINING-01', projectType: 'TEMPLATE_PREDEFINED_IDS' })).toBe('GENERIC_MANIFEST');
            expect(projectPolicyService.getEffectiveTemplate({ code: 'MINING-01', projectType: 'GENERIC_MANIFEST' })).toBe('GENERIC_MANIFEST');
        });

        test('identifies GENERIC_OPEN_INTAKE for generic open intake', () => {
            expect(projectPolicyService.getEffectiveTemplate({ code: 'AG-EXP-01', projectType: 'OPEN_INTAKE' })).toBe('GENERIC_OPEN_INTAKE');
            expect(projectPolicyService.getEffectiveTemplate(null)).toBe('GENERIC_OPEN_INTAKE');
        });
    });

    describe('canAdmitSample', () => {
        const soilferProject = { code: 'SOILFER-GTM', projectType: 'SOILFER_V1', status: 'ACTIVE', labId: 'GTM-LAB1' };
        const openProject = { code: 'DEMO-OPEN', projectType: 'OPEN_INTAKE', status: 'ACTIVE' };
        const closedProject = { code: 'SOILFER-GTM', projectType: 'SOILFER_V1', status: 'CLOSED' };
        const pausedProject = { code: 'SOILFER-GTM', projectType: 'SOILFER_V1', status: 'PAUSED' };
        const draftProject = { code: 'SOILFER-GTM', projectType: 'SOILFER_V1', status: 'DRAFT' };
        const genericKoboProject = { code: 'WATERSHED-2026', projectType: 'KOBO_LINKED', status: 'ACTIVE' };

        test('blocks admission on CLOSED, ARCHIVED, or PAUSED projects', () => {
            expect(projectPolicyService.canAdmitSample({ project: closedProject, channel: 'KOBO' })).toEqual(
                expect.objectContaining({ allowed: false, code: 'PROJECT_CLOSED' })
            );
            expect(projectPolicyService.canAdmitSample({ project: pausedProject, channel: 'KOBO' })).toEqual(
                expect.objectContaining({ allowed: false, code: 'PROJECT_PAUSED' })
            );
        });

        test('allows manifest staging on DRAFT projects but blocks desk/kobo intake', () => {
            expect(projectPolicyService.canAdmitSample({ project: draftProject, channel: 'MANIFEST' })).toEqual(
                expect.objectContaining({ allowed: true })
            );
            expect(projectPolicyService.canAdmitSample({ project: draftProject, channel: 'DESK' })).toEqual(
                expect.objectContaining({ allowed: false, code: 'PROJECT_INACTIVE' })
            );
        });

        test('SoilFER requires Kobo or authorized exception for desk intake', () => {
            // Kobo channel allowed
            expect(projectPolicyService.canAdmitSample({ project: soilferProject, channel: 'KOBO' })).toEqual(
                expect.objectContaining({ allowed: true })
            );

            // SoilFER MANIFEST without exception is blocked (Independent Review Probe 2)
            const manifestNoEx = projectPolicyService.canAdmitSample({ project: soilferProject, channel: 'MANIFEST', hasException: false });
            expect(manifestNoEx.allowed).toBe(false);
            expect(manifestNoEx.code).toBe('EXCEPTION_REQUIRED');

            // Unexcepted desk intake blocked
            const unexcepted = projectPolicyService.canAdmitSample({ project: soilferProject, channel: 'DESK', hasException: false });
            expect(unexcepted.allowed).toBe(false);
            expect(unexcepted.exceptionRequired).toBe(true);
            expect(unexcepted.code).toBe('EXCEPTION_REQUIRED');

            // SAMPLE_RECEPTION actor with claimed authorizer string is rejected (Independent Review Probe 1)
            const receptionActor = { role: 'SAMPLE_RECEPTION', labId: 'GTM-LAB1', isActive: true, username: 'reception_staff' };
            const fakeAuthAttempt = projectPolicyService.canAdmitSample({
                project: soilferProject,
                channel: 'DESK',
                actor: receptionActor,
                hasException: true,
                exceptionRecord: { reason: 'Field tablet broke', authorizer: 'admin_user' }
            });
            expect(fakeAuthAttempt.allowed).toBe(false);
            expect(fakeAuthAttempt.code).toBe('EXCEPTION_NOT_AUTHORIZED');

            // Desk intake with authorized actor (Super Admin) is allowed
            const adminActor = { role: 'SUPER_ADMIN', isActive: true, username: 'super_admin' };
            const adminExcepted = projectPolicyService.canAdmitSample({
                project: soilferProject,
                channel: 'DESK',
                actor: adminActor,
                hasException: true,
                exceptionRecord: { reason: 'Field tablet broke on site' }
            });
            expect(adminExcepted.allowed).toBe(true);
            expect(adminExcepted.isException).toBe(true);
            expect(adminExcepted.authorizedBy).toBe('super_admin');

            // Reception actor with verified stored approval is allowed
            const storedApprovalExcepted = projectPolicyService.canAdmitSample({
                project: soilferProject,
                channel: 'DESK',
                actor: receptionActor,
                hasException: true,
                exceptionRecord: {
                    reason: 'Field tablet broke on site',
                    isStoredApprovalVerified: true,
                    verifiedAuthorizer: 'lab_director_jane'
                }
            });
            expect(storedApprovalExcepted.allowed).toBe(true);
            expect(storedApprovalExcepted.isException).toBe(true);
            expect(storedApprovalExcepted.authorizedBy).toBe('lab_director_jane');
        });

        test('Generic Kobo project rejects desk intake without exception (Independent Review Probe 4)', () => {
            const genericKoboNoEx = projectPolicyService.canAdmitSample({
                project: genericKoboProject,
                channel: 'DESK',
                hasException: false
            });
            expect(genericKoboNoEx.allowed).toBe(false);
            expect(genericKoboNoEx.code).toBe('KOBO_REQUIRED');
        });

        test('Generic Open Intake allows desk intake without exception', () => {
            const openIntake = projectPolicyService.canAdmitSample({ project: openProject, channel: 'DESK' });
            expect(openIntake.allowed).toBe(true);
        });

        test('Projectless walk-in is always allowed', () => {
            expect(projectPolicyService.canAdmitSample({ project: null, channel: 'WALK_IN' })).toEqual(
                expect.objectContaining({ allowed: true })
            );
        });
    });

    describe('getProjectCapabilities', () => {
        const project = { id: 'p1', code: 'SOILFER-GTM', labId: 'GTM-LAB1', status: 'ACTIVE' };

        test('super admin has all capabilities', () => {
            const actor = { role: 'SUPER_ADMIN', isActive: true };
            const caps = projectPolicyService.getProjectCapabilities(actor, project);
            expect(caps.canRead).toBe(true);
            expect(caps.canEditPlan).toBe(true);
            expect(caps.canManageAccess).toBe(true);
            expect(caps.canManageConnections).toBe(true);
            expect(caps.canTransition).toBe(true);
            expect(caps.canImport).toBe(true);
            expect(caps.canAuthorizeException).toBe(true);
        });

        test('coordinating lab manager has lab-scoped management', () => {
            const actor = { role: 'LAB_MANAGER', labId: 'GTM-LAB1', isActive: true };
            const caps = projectPolicyService.getProjectCapabilities(actor, project);
            expect(caps.canRead).toBe(true);
            expect(caps.canEditPlan).toBe(true);
            expect(caps.canManageConnections).toBe(true);
            expect(caps.canAuthorizeException).toBe(true);
        });

        test('servicing lab manager cannot manage project access or transition project', () => {
            const actor = { role: 'LAB_MANAGER', labId: 'OTHER-LAB', isActive: true };
            const caps = projectPolicyService.getProjectCapabilities(actor, project);
            expect(caps.canManageAccess).toBe(false);
            expect(caps.canTransition).toBe(false);
            expect(caps.canManageConnections).toBe(false);
        });

        test('reception staff can import but not edit plan or manage connections', () => {
            const actor = { role: 'SAMPLE_RECEPTION', labId: 'GTM-LAB1', isActive: true };
            const caps = projectPolicyService.getProjectCapabilities(actor, project);
            expect(caps.canRead).toBe(true);
            expect(caps.canImport).toBe(true);
            expect(caps.canEditPlan).toBe(false);
            expect(caps.canManageConnections).toBe(false);
            expect(caps.canAuthorizeException).toBe(false);
        });
    });
});
