const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../prisma');

const sha256 = (data) => crypto.createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');

// Explicit reviewed public visibility set (Finding 7)
// Only login/orientation and core system error/support guides are public.
// All bench/operational/method guides remain AUTHENTICATED.
const EXPLICIT_PUBLIC_ARTICLE_IDS = new Set([
    'start-shift',
    'start-first-login',
    'manage-support',
    'manage-load-error',
    'manage-language'
]);

async function seedHelpContent() {
    console.log('[HELP_SEED] Starting help content seeding from server/data/help/...');
    const helpDataDir = path.resolve(__dirname, '../data/help');
    const contentEnFile = path.join(helpDataDir, 'content.en.json');

    if (!fs.existsSync(contentEnFile)) {
        throw new Error(`content.en.json not found at ${contentEnFile}`);
    }

    const contentData = JSON.parse(fs.readFileSync(contentEnFile, 'utf8'));

    // Load localized files
    const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
    const localizedData = {};
    for (const loc of locales) {
        const locFile = path.join(helpDataDir, `content.${loc}.json`);
        if (fs.existsSync(locFile)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(locFile, 'utf8'));
                const map = {};
                (parsed.articles || []).forEach(a => { map[a.id] = a; });
                localizedData[loc] = map;
            } catch (e) {
                console.warn(`[HELP_SEED] Could not parse ${locFile}:`, e.message);
                localizedData[loc] = {};
            }
        } else {
            localizedData[loc] = {};
        }
    }

    const { articles } = contentData;
    let createdCount = 0;
    let updatedCount = 0;

    for (const article of articles) {
        const visibility = EXPLICIT_PUBLIC_ARTICLE_IDS.has(article.id) ? 'PUBLIC' : 'AUTHENTICATED';
        const sourceHash = sha256({
            id: article.id,
            title: article.title,
            summary: article.summary,
            steps: article.steps,
            success: article.success,
            caution: article.caution
        });

        const existingArticle = await prisma.helpArticle.findUnique({
            where: { id: article.id },
            include: {
                revisions: {
                    where: { revisionNumber: 1 },
                    include: { locales: true }
                }
            }
        });

        if (!existingArticle) {
            // Create article with draft revision 1 and localized entries
            await prisma.helpArticle.create({
                data: {
                    id: article.id,
                    category: article.category,
                    kind: article.kind,
                    feature: article.feature || 'core',
                    roles: JSON.stringify(article.roles || ['all']),
                    keywords: JSON.stringify(article.keywords || []),
                    minutes: article.minutes || 2,
                    reviewOwner: article.reviewOwner || 'Lab operations lead',
                    visibility,
                    revisions: {
                        create: {
                            revisionNumber: 1,
                            title: article.title,
                            summary: article.summary,
                            steps: JSON.stringify(article.steps || []),
                            success: article.success || '',
                            caution: article.caution || '',
                            related: JSON.stringify(article.related || []),
                            sourceLocale: 'en',
                            sourceHash,
                            changeReason: 'Initial starter editorial draft from application guidance registry',
                            authorId: 'system',
                            locales: {
                                create: locales.map(locale => {
                                    const locArt = localizedData[locale]?.[article.id] || article;
                                    return {
                                        locale,
                                        title: locArt.title || article.title,
                                        summary: locArt.summary || article.summary,
                                        steps: JSON.stringify(locArt.steps || article.steps || []),
                                        success: locArt.success || article.success || '',
                                        caution: locArt.caution || article.caution || '',
                                        // Finding 1: en starts as EDITORIAL_DRAFT, others as TRANSLATION_REQUIRED
                                        reviewStatus: locale === 'en' ? 'EDITORIAL_DRAFT' : 'TRANSLATION_REQUIRED'
                                    };
                                })
                            }
                        }
                    }
                }
            });

            // CRITICAL: DO NOT CREATE HelpPublication. Starter drafts MUST NOT be published until authorized approval.
            createdCount++;
        } else {
            // Update metadata and ensure locale rows exist
            await prisma.helpArticle.update({
                where: { id: article.id },
                data: {
                    category: article.category,
                    kind: article.kind,
                    feature: article.feature || 'core',
                    roles: JSON.stringify(article.roles || ['all']),
                    keywords: JSON.stringify(article.keywords || []),
                    minutes: article.minutes || 2,
                    reviewOwner: article.reviewOwner || 'Lab operations lead',
                    visibility
                }
            });

            const rev1 = existingArticle.revisions[0];
            if (rev1) {
                await prisma.helpRevision.update({
                    where: { id: rev1.id },
                    data: {
                        title: article.title,
                        summary: article.summary,
                        steps: JSON.stringify(article.steps || []),
                        success: article.success || '',
                        caution: article.caution || '',
                        related: JSON.stringify(article.related || []),
                        sourceHash
                    }
                });

                for (const locale of locales) {
                    const existingLocaleRev = rev1.locales?.find(l => l.locale === locale);
                    const locArt = localizedData[locale]?.[article.id] || article;
                    if (!existingLocaleRev) {
                        // Insert missing locale row
                        await prisma.helpLocaleRevision.create({
                            data: {
                                revisionId: rev1.id,
                                locale,
                                title: locArt.title || article.title,
                                summary: locArt.summary || article.summary,
                                steps: JSON.stringify(locArt.steps || article.steps || []),
                                success: locArt.success || article.success || '',
                                caution: locArt.caution || article.caution || '',
                                reviewStatus: locale === 'en' ? 'EDITORIAL_DRAFT' : 'TRANSLATION_REQUIRED'
                            }
                        });
                    } else {
                        await prisma.helpLocaleRevision.update({
                            where: { id: existingLocaleRev.id },
                            data: {
                                title: locArt.title || article.title,
                                summary: locArt.summary || article.summary,
                                steps: JSON.stringify(locArt.steps || article.steps || []),
                                success: locArt.success || article.success || '',
                                caution: locArt.caution || article.caution || ''
                            }
                        });
                    }
                }
            }

            updatedCount++;
        }
    }

    // Targeted audited supersession: supersede accidental seed publications while preserving history (Finding 4)
    const accidentalSeedPubs = await prisma.helpPublication.findMany({
        where: {
            publishedBy: 'system',
            isCurrent: true
        },
        include: {
            revision: {
                include: { locales: true }
            }
        }
    });

    let supersededCount = 0;
    for (const pub of accidentalSeedPubs) {
        const hasHumanApproval = pub.revision?.locales?.some(l => l.reviewStatus === 'APPROVED');
        if (!hasHumanApproval) {
            await prisma.helpPublication.update({
                where: { id: pub.id },
                data: { isCurrent: false }
            });
            supersededCount++;
        }
    }
    if (supersededCount > 0) {
        console.log(`[HELP_SEED] Superseded ${supersededCount} unreviewed accidental seed publications (audit history preserved).`);
    }

    console.log(`[HELP_SEED] Seeding completed: ${createdCount} created, ${updatedCount} updated. 0 unreviewed drafts published.`);
}

if (require.main === module) {
    seedHelpContent()
        .catch(err => {
            console.error('[HELP_SEED] Fatal error:', err);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}

module.exports = { seedHelpContent };
