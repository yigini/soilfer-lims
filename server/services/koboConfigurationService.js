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
        const destinationKey = config?.labId || labId;
        const destination = destinationKey ? await tx.lab.findFirst({where: {OR: [{id: destinationKey}, {code: destinationKey}]}}) : null;
        const membership = await membershipService.resolveProjectLabs(project, tx);
        const administrator = ['SUPER_ADMIN', 'ADMIN'].includes(currentActor?.role);
        const manager = currentActor?.role === 'LAB_MANAGER' && [project?.labId, destination?.id].includes(currentActor?.labId);
        if (!project || (configId && (!config || ![project.id, project.code].includes(config.projectCode)))) throw failure(403, 'FORBIDDEN_CONNECTION_SCOPE', 'This Kobo connection does not belong to this project.');
        if (!destination) throw failure(403, 'DESTINATION_LAB_NOT_FOUND', `The Kobo destination laboratory '${destinationKey}' no longer exists.`);
        if (!destination.isActive) throw failure(403, 'DESTINATION_LAB_INACTIVE', `The Kobo destination laboratory '${destination.code || destination.id}' is inactive. Reactivate it in Lab Management first.`);
        if (!membership.isMember(destination.id)) throw failure(403, 'LAB_NOT_PROJECT_MEMBER', `Laboratory '${destination.code || destination.id}' receives this project's Kobo samples but is not one of the project's labs. Add it under Labs & people (servicing labs), then try again.`);
        if (!administrator && !manager) throw failure(403, 'FORBIDDEN_CONNECTION_SCOPE', 'Only an administrator or a manager of the owner or destination laboratory can change this Kobo connection.');
        if (config && Object.hasOwn(data, 'fieldMapping') && (!expectedRevision || new Date(expectedRevision).getTime() !== config.updatedAt.getTime())) throw failure(409, 'STALE_REVISION', 'The connection changed. Reload it before saving the mapping.');
        const saved = config ? await tx.koboConfig.update({where: {id: config.id, updatedAt: config.updatedAt}, data}) : await tx.koboConfig.create({data: {...data, labId: destination.id, projectCode: project.code}});
        await tx.auditLog.create({data: {id: crypto.randomUUID(), entity: 'KOBO_CONFIG', entityId: saved.id, action: config ? 'KOBO_CONNECTION_UPDATED' : 'KOBO_CONNECTION_CREATED', details: JSON.stringify({projectCode: project.code, labId: destination.id, mappingChanged: Object.hasOwn(data, 'fieldMapping')}), performedBy: currentActor.username, timestamp: new Date()}});
        return saved;
    });
}
module.exports = {save};
