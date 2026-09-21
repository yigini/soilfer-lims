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

    describe('HTTP Trust Boundary Exception Verification (resolveAndVerifyExceptionRecord)', () => {
        const soilferProject = {
            id: 'SOILFER-GTM',
            code: 'SOILFER-GTM',
            labId: 'GTM-LAB1',
            status: 'ACTIVE',
            projectType: 'SOILFER_V1'
        };

        const mockPrisma = {
            sampleAmendment: {
                findUnique: jest.fn()
            },
            auditLog: {
                findFirst: jest.fn()
            },
            user: {
                findUnique: jest.fn()
            }
        };

        test('Client-supplied isStoredApprovalVerified boolean is strictly stripped and rejected when actor is unprivileged', async () => {
            const technicianActor = { username: 'tech_bob', role: 'LAB_TECHNICIAN', labId: 'GTM-LAB1', isActive: true };
            const maliciousClientPayload = {
                reason: 'Spoofed emergency exception',
                isStoredApprovalVerified: true,
                verifiedAuthorizer: 'super_admin'
            };

            const resolved = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: maliciousClientPayload,
                actor: technicianActor,
                project: soilferProject,
                labId: 'GTM-LAB1',
                prismaClient: mockPrisma
            });

            expect(resolved.hasException).toBe(true);
            expect(resolved.exceptionRecord.isStoredApprovalVerified).toBe(false);
            expect(resolved.exceptionRecord.mode).toBe('UNVERIFIED');

            // Admission must fail closed
            const admission = projectPolicyService.canAdmitSample({
                project: soilferProject,
                channel: 'DESK',
                actor: technicianActor,
                labId: 'GTM-LAB1',
                hasException: resolved.hasException,
                exceptionRecord: resolved.exceptionRecord
            });

            expect(admission.allowed).toBe(false);
            expect(admission.code).toBe('EXCEPTION_NOT_AUTHORIZED');
        });

        test('Direct authority: Lab manager self-authorizes exception', async () => {
            const managerActor = { username: 'mgr_gtm', role: 'LAB_MANAGER', labId: 'GTM-LAB1', isActive: true };
            const clientPayload = { reason: 'Field power outage' };

            const resolved = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: clientPayload,
                actor: managerActor,
                project: soilferProject,
                labId: 'GTM-LAB1',
                prismaClient: mockPrisma
            });

            expect(resolved.hasException).toBe(true);
            expect(resolved.exceptionRecord.isStoredApprovalVerified).toBe(true);
            expect(resolved.exceptionRecord.verifiedAuthorizer).toBe('mgr_gtm');
            expect(resolved.exceptionRecord.mode).toBe('ACTOR_AUTHORIZED');

            const admission = projectPolicyService.canAdmitSample({
                project: soilferProject,
                channel: 'DESK',
                actor: managerActor,
                labId: 'GTM-LAB1',
                hasException: resolved.hasException,
                exceptionRecord: resolved.exceptionRecord
            });

            expect(admission.allowed).toBe(true);
            expect(admission.isException).toBe(true);
        });

        test('Stored approval: Unprivileged reception staff with valid persisted SampleAmendment is allowed', async () => {
            const receptionActor = { username: 'rec_sue', role: 'SAMPLE_RECEPTION', labId: 'GTM-LAB1', isActive: true };
            
            mockPrisma.sampleAmendment.findUnique.mockResolvedValueOnce({
                id: 'AMD-VALID-001',
                sampleId: 'SMP-001',
                type: 'DESK_ADMISSION_EXCEPTION',
                status: 'APPROVED',
                authorizedBy: 'mgr_gtm',
                reason: 'Formal waiver for cracked vial container',
                sample: {
                    id: 'SMP-001',
                    projectId: 'SOILFER-GTM',
                    projectCode: 'SOILFER-GTM',
                    assignedLab: 'GTM-LAB1',
                    labId: 'GTM-LAB1'
                }
            });
            mockPrisma.user.findUnique.mockResolvedValueOnce({
                username: 'mgr_gtm',
                role: 'LAB_MANAGER',
                labId: 'GTM-LAB1',
                isActive: true
            });

            const resolved = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: { reason: 'Formal waiver for cracked vial container' },
                approvalId: 'AMD-VALID-001',
                actor: receptionActor,
                project: soilferProject,
                labId: 'GTM-LAB1',
                sampleId: 'SMP-001',
                channel: 'DESK',
                prismaClient: mockPrisma
            });

            expect(resolved.hasException).toBe(true);
            expect(resolved.exceptionRecord.isStoredApprovalVerified).toBe(true);
            expect(resolved.exceptionRecord.verifiedAuthorizer).toBe('mgr_gtm');
            expect(resolved.exceptionRecord.mode).toBe('STORED_APPROVAL');

            const admission = projectPolicyService.canAdmitSample({
                project: soilferProject,
                channel: 'DESK',
                actor: receptionActor,
                labId: 'GTM-LAB1',
                hasException: resolved.hasException,
                exceptionRecord: resolved.exceptionRecord
            });

            expect(admission.allowed).toBe(true);
            expect(admission.isException).toBe(true);
        });

        test('Stored approval: Invalid or unapproved record fails closed', async () => {
            const receptionActor = { username: 'rec_sue', role: 'SAMPLE_RECEPTION', labId: 'GTM-LAB1', isActive: true };

            mockPrisma.sampleAmendment.findUnique.mockResolvedValueOnce({
                id: 'AMD-PENDING-001',
                sampleId: 'SMP-001',
                type: 'DESK_ADMISSION_EXCEPTION',
                status: 'PENDING', // Not yet approved!
                authorizedBy: null,
                reason: 'Pending waiver'
            });

            const resolved = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: { reason: 'Pending approval test' },
                approvalId: 'AMD-PENDING-001',
                actor: receptionActor,
                project: soilferProject,
                labId: 'GTM-LAB1',
                sampleId: 'SMP-001',
                channel: 'DESK',
                prismaClient: mockPrisma
            });

            expect(resolved.hasException).toBe(true);
            expect(resolved.exceptionRecord.isStoredApprovalVerified).toBe(false);

            const admission = projectPolicyService.canAdmitSample({
                project: soilferProject,
                channel: 'DESK',
                actor: receptionActor,
                labId: 'GTM-LAB1',
                hasException: resolved.hasException,
                exceptionRecord: resolved.exceptionRecord
            });

            expect(admission.allowed).toBe(false);
            expect(admission.code).toBe('EXCEPTION_NOT_AUTHORIZED');
        });

        test('Stored approval: Cross-sample mismatch fails closed', async () => {
            const receptionActor = { username: 'rec_sue', role: 'SAMPLE_RECEPTION', labId: 'GTM-LAB1', isActive: true };

            // Persisted amendment is bound to SMP-001
            mockPrisma.sampleAmendment.findUnique.mockResolvedValueOnce({
                id: 'AMD-SAMPLE-001',
                sampleId: 'SMP-001',
                type: 'DESK_ADMISSION_EXCEPTION',
                status: 'APPROVED',
                authorizedBy: 'mgr_gtm',
                reason: 'Specific exception for SMP-001',
                sample: {
                    id: 'SMP-001',
                    projectId: 'SOILFER-GTM',
                    projectCode: 'SOILFER-GTM',
                    assignedLab: 'GTM-LAB1',
                    labId: 'GTM-LAB1'
                }
            });
            mockPrisma.user.findUnique.mockResolvedValueOnce({
                username: 'mgr_gtm',
                role: 'LAB_MANAGER',
                labId: 'GTM-LAB1',
                isActive: true
            });

            // Attacker / unprivileged staff attempts to use AMD-SAMPLE-001 for SMP-999
            const resolved = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: { reason: 'Reused waiver from SMP-001' },
                approvalId: 'AMD-SAMPLE-001',
                actor: receptionActor,
                project: soilferProject,
                labId: 'GTM-LAB1',
                sampleId: 'SMP-999',
                channel: 'DESK',
                prismaClient: mockPrisma
            });

            expect(resolved.hasException).toBe(true);
            expect(resolved.exceptionRecord.isStoredApprovalVerified).toBe(false);

            const admission = projectPolicyService.canAdmitSample({
                project: soilferProject,
                channel: 'DESK',
                actor: receptionActor,
                labId: 'GTM-LAB1',
                hasException: resolved.hasException,
                exceptionRecord: resolved.exceptionRecord
            });

            expect(admission.allowed).toBe(false);
            expect(admission.code).toBe('EXCEPTION_NOT_AUTHORIZED');
        });

        test('Stored approval: Cross-project mismatch fails closed via schema sample relation', async () => {
            const receptionActor = { username: 'rec_sue', role: 'SAMPLE_RECEPTION', labId: 'GTM-LAB1', isActive: true };

            // Persisted amendment's linked sample is bound to project SOILFER-GTM
            mockPrisma.sampleAmendment.findUnique.mockResolvedValueOnce({
                id: 'AMD-PROJ-001',
                sampleId: 'SMP-001',
                type: 'DESK_ADMISSION_EXCEPTION',
                status: 'APPROVED',
                authorizedBy: 'mgr_gtm',
                reason: 'Exception approved strictly for GTM project',
                sample: {
                    id: 'SMP-001',
                    projectId: 'SOILFER-GTM',
                    projectCode: 'SOILFER-GTM',
                    assignedLab: 'GTM-LAB1',
                    labId: 'GTM-LAB1'
                }
            });
            mockPrisma.user.findUnique.mockResolvedValueOnce({
                username: 'mgr_gtm',
                role: 'LAB_MANAGER',
                labId: 'GTM-LAB1',
                isActive: true
            });

            // Intake requested for project WATERSHED-2026
            const otherProject = { id: 'WATERSHED-2026', code: 'WATERSHED-2026', projectType: 'KOBO_LINKED', status: 'ACTIVE' };
            const resolved = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: { reason: 'Cross-project reuse attempt' },
                approvalId: 'AMD-PROJ-001',
                actor: receptionActor,
                project: otherProject,
                labId: 'GTM-LAB1',
                sampleId: 'SMP-001',
                channel: 'DESK',
                prismaClient: mockPrisma
            });

            expect(resolved.hasException).toBe(true);
            expect(resolved.exceptionRecord.isStoredApprovalVerified).toBe(false);

            const admission = projectPolicyService.canAdmitSample({
                project: otherProject,
                channel: 'DESK',
                actor: receptionActor,
                labId: 'GTM-LAB1',
                hasException: resolved.hasException,
                exceptionRecord: resolved.exceptionRecord
            });

            expect(admission.allowed).toBe(false);
            expect(admission.code).toBe('EXCEPTION_NOT_AUTHORIZED');
        });

        test('Stored approval: Cross-lab mismatch fails closed via schema sample relation', async () => {
            const receptionActor = { username: 'rec_hnd', role: 'SAMPLE_RECEPTION', labId: 'HND-LAB2', isActive: true };

            // Persisted amendment's linked sample is bound to lab GTM-LAB1
            mockPrisma.sampleAmendment.findUnique.mockResolvedValueOnce({
                id: 'AMD-LAB-001',
                sampleId: 'SMP-001',
                type: 'DESK_ADMISSION_EXCEPTION',
                status: 'APPROVED',
                authorizedBy: 'mgr_gtm',
                reason: 'Exception approved for GTM lab only',
                sample: {
                    id: 'SMP-001',
                    projectId: 'SOILFER-GTM',
                    projectCode: 'SOILFER-GTM',
                    assignedLab: 'GTM-LAB1',
                    labId: 'GTM-LAB1'
                }
            });
            mockPrisma.user.findUnique.mockResolvedValueOnce({
                username: 'mgr_gtm',
                role: 'LAB_MANAGER',
                labId: 'GTM-LAB1',
                isActive: true
            });

            // Intake requested in lab HND-LAB2
            const resolved = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: { reason: 'Cross-lab waiver reuse' },
                approvalId: 'AMD-LAB-001',
                actor: receptionActor,
                project: soilferProject,
                labId: 'HND-LAB2',
                sampleId: 'SMP-001',
                channel: 'DESK',
                prismaClient: mockPrisma
            });

            expect(resolved.hasException).toBe(true);
            expect(resolved.exceptionRecord.isStoredApprovalVerified).toBe(false);
        });

        // ── Monitor Probe Scenarios (Phase 0 Review Checkpoint 5f66781) ──

        test('Monitor Probe 1: Target sample omitted fails closed', async () => {
            const receptionActor = { username: 'rec_sue', role: 'SAMPLE_RECEPTION', labId: 'GTM-LAB1', isActive: true };
            const verification = await projectPolicyService.verifyStoredExceptionApproval({
                approvalId: 'AMD-SYNTH-001',
                project: soilferProject,
                labId: 'GTM-LAB1',
                sampleId: null, // Target sample omitted!
                channel: 'DESK',
                prismaClient: mockPrisma
            });
            expect(verification.isStoredApprovalVerified).toBe(false);
            expect(verification.code).toBe('TARGET_SAMPLE_REQUIRED');
        });

        test('Monitor Probe 2: Batch sampleIds with only 1 covered fails closed', async () => {
            mockPrisma.sampleAmendment.findUnique.mockResolvedValueOnce({
                id: 'AMD-SYNTH-002',
                sampleId: 'S-A',
                type: 'DESK_ADMISSION_EXCEPTION',
                status: 'APPROVED',
                authorizedBy: 'super_admin',
                reason: 'Approved only for S-A',
                sample: { id: 'S-A', projectId: 'SOILFER-GTM', projectCode: 'SOILFER-GTM', assignedLab: 'GTM-LAB1', labId: 'GTM-LAB1' }
            });
            const verification = await projectPolicyService.verifyStoredExceptionApproval({
                approvalId: 'AMD-SYNTH-002',
                project: soilferProject,
                labId: 'GTM-LAB1',
                sampleIds: ['S-A', 'S-B'], // Batch requires covering both!
                channel: 'DESK',
                prismaClient: mockPrisma
            });
            expect(verification.isStoredApprovalVerified).toBe(false);
            expect(verification.code).toBe('APPROVAL_BATCH_NOT_COVERED');
        });

        test('Monitor Probe 3: CLERICAL amendment used for MANIFEST admission fails closed', async () => {
            mockPrisma.sampleAmendment.findUnique.mockResolvedValueOnce({
                id: 'AMD-SYNTH-003',
                sampleId: 'S-A',
                type: 'CLERICAL', // Routine amendment, not admission exception!
                status: 'APPROVED',
                authorizedBy: 'super_admin',
                reason: 'Typo fixed on bag tag',
                sample: { id: 'S-A', projectId: 'SOILFER-GTM', projectCode: 'SOILFER-GTM', assignedLab: 'GTM-LAB1', labId: 'GTM-LAB1' }
            });
            const verification = await projectPolicyService.verifyStoredExceptionApproval({
                approvalId: 'AMD-SYNTH-003',
                project: soilferProject,
                labId: 'GTM-LAB1',
                sampleId: 'S-A',
                channel: 'MANIFEST',
                prismaClient: mockPrisma
            });
            expect(verification.isStoredApprovalVerified).toBe(false);
            expect(verification.code).toBe('APPROVAL_TYPE_MISMATCH');
        });

        test('Monitor Probe 4: Admin authorized amendment for sample-A cannot be reused for unrelated TARGET-B/LAB-B', async () => {
            const receptionActor = { username: 'rec_lab_b', role: 'SAMPLE_RECEPTION', labId: 'LAB-B', isActive: true };
            mockPrisma.sampleAmendment.findUnique.mockResolvedValueOnce({
                id: 'AMD-SAMPLE-A',
                sampleId: 'sample-A',
                type: 'DESK_ADMISSION_EXCEPTION',
                status: 'APPROVED',
                authorizedBy: 'admin_user',
                reason: 'Approved for sample-A in PROJECT-A',
                sample: { id: 'sample-A', projectId: 'PROJECT-A', projectCode: 'PROJECT-A', assignedLab: 'LAB-A', labId: 'LAB-A' }
            });
            mockPrisma.user.findUnique.mockResolvedValueOnce({
                username: 'admin_user',
                role: 'ADMIN',
                isActive: true
            });

            // Target request is for TARGET-B in LAB-B for sample-B
            const targetB = { id: 'TARGET-B', code: 'TARGET-B', projectType: 'SOILFER_V1', status: 'ACTIVE' };
            const resolved = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: { reason: 'Reusing admin approval' },
                approvalId: 'AMD-SAMPLE-A',
                actor: receptionActor,
                project: targetB,
                labId: 'LAB-B',
                sampleId: 'sample-B',
                channel: 'DESK',
                prismaClient: mockPrisma
            });

            expect(resolved.hasException).toBe(true);
            expect(resolved.exceptionRecord.isStoredApprovalVerified).toBe(false);

            const admission = projectPolicyService.canAdmitSample({
                project: targetB,
                channel: 'DESK',
                actor: receptionActor,
                labId: 'LAB-B',
                hasException: resolved.hasException,
                exceptionRecord: resolved.exceptionRecord
            });
            expect(admission.allowed).toBe(false);
            expect(admission.code).toBe('EXCEPTION_NOT_AUTHORIZED');
        });

        test('Monitor Probe 5: Empty exception object or short reason fails closed even with role-bearing manager', async () => {
            const managerActor = { username: 'mgr_gtm', role: 'LAB_MANAGER', labId: 'GTM-LAB1', isActive: true };

            // Empty exception object passed
            const resolved = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: {}, // Empty object!
                actor: managerActor,
                project: soilferProject,
                labId: 'GTM-LAB1',
                channel: 'DESK',
                prismaClient: mockPrisma
            });

            expect(resolved.hasException).toBe(true);
            expect(resolved.exceptionRecord.isStoredApprovalVerified).toBe(false);
            expect(resolved.exceptionRecord.code).toBe('APPROVAL_EMPTY_REASON');

            const admission = projectPolicyService.canAdmitSample({
                project: soilferProject,
                channel: 'DESK',
                actor: managerActor,
                labId: 'GTM-LAB1',
                hasException: resolved.hasException,
                exceptionRecord: resolved.exceptionRecord
            });
            expect(admission.allowed).toBe(false);
            expect(admission.code).toBe('EXCEPTION_REASON_REQUIRED');
        });
    });
});
