export const chapters = [
    {
        id: 'welcome',
        nameKey: 'chapters.welcome.name',
        roleKey: 'roles.visitor',
        route: '/login?tutorialmode=true&tour=first-visit',
        titleKey: 'chapters.welcome.title',
        copyKey: 'chapters.welcome.copy',
        whyKey: 'chapters.welcome.why',
        nextKey: 'chapters.welcome.next'
    },
    {
        id: 'identity',
        nameKey: 'chapters.identity.name',
        roleKey: 'roles.reception',
        route: '/login → /',
        titleKey: 'chapters.identity.title',
        copyKey: 'chapters.identity.copy',
        whyKey: 'chapters.identity.why',
        nextKey: 'chapters.identity.next'
    },
    {
        id: 'field',
        nameKey: 'chapters.field.name',
        roleKey: 'roles.reception',
        route: '/projects/:projectId?tab=connections',
        titleKey: 'chapters.field.title',
        copyKey: 'chapters.field.copy',
        whyKey: 'chapters.field.why',
        nextKey: 'chapters.field.next'
    },
    {
        id: 'intake',
        nameKey: 'chapters.intake.name',
        roleKey: 'roles.reception',
        route: '/reception?sampleId=:authorizedSampleId',
        titleKey: 'chapters.intake.title',
        copyKey: 'chapters.intake.copy',
        whyKey: 'chapters.intake.why',
        nextKey: 'chapters.intake.next',
        practiceType: 'intake'
    },
    {
        id: 'prepare',
        nameKey: 'chapters.prepare.name',
        roleKey: 'roles.technician',
        route: '/workbench?workItemId=:dryingItemId',
        titleKey: 'chapters.prepare.title',
        copyKey: 'chapters.prepare.copy',
        whyKey: 'chapters.prepare.why',
        nextKey: 'chapters.prepare.next',
        practiceType: 'prepare'
    },
    {
        id: 'bench',
        nameKey: 'chapters.bench.name',
        roleKey: 'roles.technician',
        route: '/workbench?workItemId=:analysisItemId',
        titleKey: 'chapters.bench.title',
        copyKey: 'chapters.bench.copy',
        whyKey: 'chapters.bench.why',
        nextKey: 'chapters.bench.next',
        practiceType: 'bench'
    },
    {
        id: 'texture',
        nameKey: 'chapters.texture.name',
        roleKey: 'roles.technician',
        route: '/workbench?workItemId=:textureItemId',
        titleKey: 'chapters.texture.title',
        copyKey: 'chapters.texture.copy',
        whyKey: 'chapters.texture.why',
        nextKey: 'chapters.texture.next',
        practiceType: 'texture'
    },
    {
        id: 'spectra',
        nameKey: 'chapters.spectra.name',
        roleKey: 'roles.technician',
        route: '/workbench?workItemId=:spectralItemId',
        titleKey: 'chapters.spectra.title',
        copyKey: 'chapters.spectra.copy',
        whyKey: 'chapters.spectra.why',
        nextKey: 'chapters.spectra.next',
        practiceType: 'spectra'
    },
    {
        id: 'review',
        nameKey: 'chapters.review.name',
        roleKey: 'roles.manager',
        route: '/manager-queue?lane=review',
        titleKey: 'chapters.review.title',
        copyKey: 'chapters.review.copy',
        whyKey: 'chapters.review.why',
        nextKey: 'chapters.review.next',
        practiceType: 'review'
    },
    {
        id: 'trace',
        nameKey: 'chapters.trace.name',
        roleKey: 'roles.manager',
        route: '/samples/:id/map → /samples/:id?tab=reports',
        titleKey: 'chapters.trace.title',
        copyKey: 'chapters.trace.copy',
        whyKey: 'chapters.trace.why',
        nextKey: 'chapters.trace.next'
    },
    {
        id: 'resources',
        nameKey: 'chapters.resources.name',
        roleKey: 'roles.manager',
        route: '/equipment · /inventory · /projects/:id?tab=connections',
        titleKey: 'chapters.resources.title',
        copyKey: 'chapters.resources.copy',
        whyKey: 'chapters.resources.why',
        nextKey: 'chapters.resources.next',
        practiceType: 'resources'
    },
    {
        id: 'finish',
        nameKey: 'chapters.finish.name',
        roleKey: 'roles.assigned',
        route: '/ → /help',
        titleKey: 'chapters.finish.title',
        copyKey: 'chapters.finish.copy',
        whyKey: 'chapters.finish.why',
        nextKey: 'chapters.finish.next'
    }
];
