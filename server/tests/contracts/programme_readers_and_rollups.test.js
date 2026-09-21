'use strict';

/**
 * Contract Tests for Programme Readers, Scopes & Rollups (Finding 6)
 *
 * Verifies:
 * 1. Policy Service: Child expansion for SoilFER programmes (SOILFER-US, SOILFER-JPN).
 * 2. SIS Scoping: Expansion of programme keys and queries to child country project codes.
 * 3. ScopeGuard: Project manager grant scoping with programme rollup and entity access checks.
 */

const projectPolicyService = require('../../services/projectPolicyService');
const { buildSisWhere } = require('../../controllers/sisController');
const scopeGuard = require('../../utils/scopeGuard');

describe('Programme Readers & Rollup Contracts (Finding 6)', () => {
    describe('1. Programme Hierarchy & Child Expansion', () => {
        it('expands SOILFER-US to all 5 constituent national projects', () => {
            const children = projectPolicyService.getProgrammeChildProjectCodes('SOILFER-US');
            expect(children).toHaveLength(5);
            expect(children).toContain('SOILFER-GTM');
            expect(children).toContain('SOILFER-HND');
            expect(children).toContain('SOILFER-GHA');
            expect(children).toContain('SOILFER-KEN');
            expect(children).toContain('SOILFER-ZMB');
        });

        it('expands SOILFER-JPN to both constituent national projects', () => {
            const children = projectPolicyService.getProgrammeChildProjectCodes('SOILFER-JPN');
            expect(children).toHaveLength(2);
            expect(children).toContain('SOILFER-MOZ');
            expect(children).toContain('SOILFER-TUN');
        });

        it('returns empty array for country projects and non-programme codes', () => {
            expect(projectPolicyService.getProgrammeChildProjectCodes('SOILFER-GTM')).toEqual([]);
            expect(projectPolicyService.getProgrammeChildProjectCodes('DEMO-PROJECT')).toEqual([]);
            expect(projectPolicyService.getProgrammeChildProjectCodes(null)).toEqual([]);
        });
    });

    describe('2. SIS Controller Scope Expansion (buildSisWhere)', () => {
        it('expands programme-scoped API key to child country projects', () => {
            const sisAuth = {
                type: 'API_KEY',
                projects: ['SOILFER-US'],
                labs: ['*']
            };
            const where = buildSisWhere(sisAuth, {});
            expect(where.projectCode).toBeDefined();
            expect(where.projectCode.in).toContain('SOILFER-US');
            expect(where.projectCode.in).toContain('SOILFER-GTM');
            expect(where.projectCode.in).toContain('SOILFER-HND');
        });

        it('expands query.project=SOILFER-US to constituent country codes for global key', () => {
            const sisAuth = {
                type: 'API_KEY',
                projects: ['*'],
                labs: ['*']
            };
            const where = buildSisWhere(sisAuth, { project: 'SOILFER-US' });
            expect(where.projectCode).toBeDefined();
            expect(where.projectCode.in).toContain('SOILFER-US');
            expect(where.projectCode.in).toContain('SOILFER-GTM');
            expect(where.projectCode.in).toContain('SOILFER-ZMB');
        });

        it('denies access when requested project is outside programme scope', () => {
            const sisAuth = {
                type: 'API_KEY',
                projects: ['SOILFER-US'],
                labs: ['*']
            };
            // Requesting TUN (part of SOILFER-JPN) with US-scoped key
            const where = buildSisWhere(sisAuth, { project: 'SOILFER-TUN' });
            expect(where.projectCode).toEqual({ in: [] });
        });
    });

    describe('3. ScopeGuard Project Grants & Programme Expansion', () => {
        it('expands programme grants in buildScopedWhere for Project Managers without labId', () => {
            const pmUser = {
                id: 'user-pm-soilfer',
                role: 'PROJECT_MANAGER',
                labId: null,
                projects: ['SOILFER-US']
            };
            const where = scopeGuard.buildScopedWhere(pmUser, {}, { entityType: 'Sample' });
            expect(where.OR).toBeDefined();
            const projClause = where.OR.find(c => c.projectCode);
            expect(projClause).toBeDefined();
            expect(projClause.projectCode.in).toContain('SOILFER-US');
            expect(projClause.projectCode.in).toContain('SOILFER-GTM');
            expect(projClause.projectCode.in).toContain('SOILFER-KEN');
        });

        it('allows access to child country sample for programme-scoped actor in canAccessEntity', () => {
            const pmUser = {
                id: 'user-pm-soilfer',
                role: 'PROJECT_MANAGER',
                labId: null,
                projects: ['SOILFER-US']
            };
            const gtmSample = {
                id: 'SMP-GTM-001',
                projectCode: 'SOILFER-GTM',
                labId: 'GTM-LAB1'
            };
            const allowed = scopeGuard.canAccessEntity(pmUser, gtmSample, { entityName: 'Sample' });
            expect(allowed).toBe(true);
        });

        it('denies access to foreign project sample for programme-scoped actor', () => {
            const pmUser = {
                id: 'user-pm-soilfer',
                role: 'PROJECT_MANAGER',
                labId: null,
                projects: ['SOILFER-US']
            };
            const tunSample = {
                id: 'SMP-TUN-001',
                projectCode: 'SOILFER-TUN',
                labId: 'TUN-LAB1'
            };
            const foreignSample = {
                id: 'SMP-EXT-001',
                projectCode: 'MINING-01',
                labId: 'EXT-LAB'
            };
            expect(scopeGuard.canAccessEntity(pmUser, tunSample, { entityName: 'Sample' })).toBe(false);
            expect(scopeGuard.canAccessEntity(pmUser, foreignSample, { entityName: 'Sample' })).toBe(false);
        });
    });
});
