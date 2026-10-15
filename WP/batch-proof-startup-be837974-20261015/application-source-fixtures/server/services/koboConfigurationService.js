'use strict';
const crypto = require('crypto');
const prisma = require('../prisma');
const membershipService = require('./projectMembershipService');
const profile = require('./koboProfileService');
const failure = (status, code, message) => Object.assign(new Error(message), {status, code});

async function save({actor, projectId, configId, labId, data, expectedRevision}, db = prisma) {
    if (Object.hasOwn(data, 'fieldMapping')) profile.validateMapping(data.fieldMapping == null ? null : JSON.parse(data.fieldMapping));
    return db.$transaction(async tx => {
        const project = await tx.project.findUnique({where: {id: projectId}});
        const config = configId ? await tx.koboConfig.findUnique({where: {id: configId}}) : null;
        const currentActor = actor.id ? await tx.user.findUnique({where: {id: actor.id}}) : actor;
        const destination = await tx.lab.findUnique({where: {id: config?.labId || labId}});
        const membership = await membershipService.resolveProjectLabs(project, tx);
        const administrator = ['SUPER_ADMIN', 'ADMIN'].includes(currentActor?.role);
        const manager = currentActor?.role === 'LAB_MANAGER' && [project?.labId, destination?.id].includes(currentActor?.labId);
        if (!project || !destination?.isActive || !membership.isMember(destination.id) || (!administrator && !manager) || (configId && (!config || ![project.id, project.code].includes(config.projectCode)))) throw failure(403, 'FORBIDDEN_CONNECTION_SCOPE', 'This laboratory is no longer authorized to manage the project connection.');
        if (config && Object.hasOwn(data, 'fieldMapping') && (!expectedRevision || new Date(expectedRevision).getTime() !== config.updatedAt.getTime())) throw failure(409, 'STALE_REVISION', 'The connection changed. Reload it before saving the mapping.');
        const saved = config ? await tx.koboConfig.update({where: {id: config.id, updatedAt: config.updatedAt}, data}) : await tx.koboConfig.create({data: {...data, labId: destination.id, projectCode: project.code}});
        await tx.auditLog.create({data: {id: crypto.randomUUID(), entity: 'KOBO_CONFIG', entityId: saved.id, action: config ? 'KOBO_CONNECTION_UPDATED' : 'KOBO_CONNECTION_CREATED', details: JSON.stringify({projectCode: project.code, labId: destination.id, mappingChanged: Object.hasOwn(data, 'fieldMapping')}), performedBy: currentActor.username, timestamp: new Date()}});
        return saved;
    });
}
module.exports = {save};
