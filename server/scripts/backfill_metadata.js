/**
 * Backfill script: Re-sync EXPECTED samples with null fieldMetadata
 * 
 * For each affected sample, calls the syncSample logic to match it back
 * to its Kobo submission and populate fieldMetadata (site_id, coords, etc.)
 */
const prisma = require('/app/server/prisma');
const koboService = require('/app/server/services/koboService');

async function backfillSamples() {
    // Find all EXPECTED samples with null fieldMetadata
    const samples = await prisma.sample.findMany({
        where: {
            status: 'EXPECTED',
            fieldMetadata: null,
            projectCode: { not: null }
        },
        select: { id: true, originalId: true, assignedLab: true, projectCode: true }
    });

    console.log(`Found ${samples.length} EXPECTED samples with null fieldMetadata`);

    // Get all Kobo configs to find submissions
    const configs = await prisma.koboConfig.findMany({
        where: { isActive: true }
    });

    console.log(`Found ${configs.length} active Kobo configs`);

    let updated = 0;
    let notFound = 0;

    for (const sample of samples) {
        // Find the matching Kobo config for this sample's lab
        const config = configs.find(c => c.labId === sample.assignedLab);
        if (!config) {
            console.log(`  [SKIP] ${sample.originalId} — no Kobo config for ${sample.assignedLab}`);
            notFound++;
            continue;
        }

        try {
            // Fetch ALL submissions from this form (no since filter)
            const submissions = await koboService.fetchSubmissions(
                config.koboServerUrl,
                config.formId,
                config.apiToken,
                null // fetch all
            );

            // Find the submission that matches this sample's originalId
            const fieldMapping = config.fieldMapping ? JSON.parse(config.fieldMapping) : null;
            let matched = false;

            for (const submission of submissions) {
                const transformed = koboService.transformSubmission(submission, fieldMapping, config.labId);
                for (const t of transformed) {
                    if (t.original_id === sample.originalId) {
                        // Found the matching submission — backfill metadata
                        const now = new Date().toISOString();
                        const fm = (value) => ({ value, source: 'KOBO', lastUpdatedAt: now, lastUpdatedBy: 'BACKFILL' });

                        const categorizePhoto = (xpath) => {
                            if (!xpath) return 'other';
                            const x = xpath.toLowerCase();
                            if (x.includes('landscape') || x.includes('paisaje')) return 'landscape';
                            if (x.includes('profile') || x.includes('perfil')) return 'profile';
                            if (x.includes('sample') || x.includes('muestra')) return 'sample';
                            if (x.includes('site') || x.includes('sitio')) return 'site';
                            return 'other';
                        };

                        const processedAttachments = (submission._attachments || []).map(a => ({
                            filename: a.filename?.split('/').pop() || a.filename,
                            category: categorizePhoto(a.question_xpath),
                            question: a.question_xpath,
                            download_url: a.download_url,
                            download_small: a.download_small_url,
                            download_medium: a.download_medium_url,
                            download_large: a.download_large_url,
                            mimetype: a.mimetype
                        }));

                        const fieldMetadata = {
                            site_id: fm(t.site_id),
                            depth: fm(t.depth),
                            latitude: fm(t.lat),
                            longitude: fm(t.lng),
                            collectionDate: fm(t.collected_at),
                            kobo_submission_id: fm(t.kobo_submission_id),
                            surveyor: fm(koboService.findValue(submission, ['surveyor_name', 'username'])),
                            province: fm(koboService.findValue(submission, ['selected_province', 'provincia'])),
                            land_cover: fm(koboService.findValue(submission, ['land_cover_types', 'landcover', 'cobertura_terreno'])),
                            attachments: fm(processedAttachments)
                        };

                        const compactMeta = {
                            kobo_id: submission._id,
                            kobo_uuid: submission._uuid,
                            surveyor: koboService.findValue(submission, ['surveyor_name', 'username']),
                            site_id: t.site_id,
                            province: koboService.findValue(submission, ['selected_province', 'provincia']),
                            land_cover: koboService.findValue(submission, ['land_cover_types', 'landcover', 'cobertura_terreno']),
                            submission_time: submission._submission_time,
                            attachments: processedAttachments
                        };

                        await prisma.sample.update({
                            where: { id: sample.id },
                            data: {
                                fieldMetadata: JSON.stringify(fieldMetadata),
                                metadata: JSON.stringify(compactMeta)
                            }
                        });

                        console.log(`  [OK] ${sample.originalId} — backfilled with site_id: ${t.site_id}`);
                        updated++;
                        matched = true;
                        break;
                    }
                }
                if (matched) break;
            }

            if (!matched) {
                console.log(`  [MISS] ${sample.originalId} — no matching Kobo submission found`);
                notFound++;
            }
        } catch (err) {
            console.error(`  [ERR] ${sample.originalId} — ${err.message}`);
            notFound++;
        }
    }

    console.log(`\nDone: ${updated} updated, ${notFound} not found/skipped`);
    await prisma.$disconnect();
}

backfillSamples().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
