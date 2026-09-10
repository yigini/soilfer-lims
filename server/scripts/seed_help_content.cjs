const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../prisma');

const sha256 = (data) => crypto.createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');

async function seedHelpContent() {
    console.log('[HELP_SEED] Starting help content seeding...');
    const wpPath = path.resolve(__dirname, '../../WP/help-knowledge-base-v1');
    const contentEnFile = path.join(wpPath, 'content.en.json');
    const routeMapFile = path.join(wpPath, 'route-help-map.json');

    if (!fs.existsSync(contentEnFile)) {
        throw new Error(`content.en.json not found at ${contentEnFile}`);
    }

    const contentData = JSON.parse(fs.readFileSync(contentEnFile, 'utf8'));
    const routeMap = fs.existsSync(routeMapFile) ? JSON.parse(fs.readFileSync(routeMapFile, 'utf8')) : null;

    // Public routes determine public visibility
    const publicArticleIds = new Set(['start-shift', 'manage-support', 'manage-load-error']);
    if (routeMap?.routes) {
        for (const r of routeMap.routes) {
            if (r.auth === 'public-or-error' && Array.isArray(r.articleIds)) {
                r.articleIds.forEach(id => publicArticleIds.add(id));
            }
        }
    }

    const { articles } = contentData;
    const locales = ['en', 'es', 'es-419', 'fr', 'pt'];

    let createdCount = 0;
    let updatedCount = 0;

    for (const article of articles) {
        const articleHash = sha256(article);
        const visibility = publicArticleIds.has(article.id) ? 'PUBLIC' : 'AUTHENTICATED';

        const existingArticle = await prisma.helpArticle.findUnique({
            where: { id: article.id }
        });

        if (!existingArticle) {
            // Create article
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
                            sourceHash: articleHash,
                            changeReason: 'Initial starter editorial draft from WP/help-knowledge-base-v1',
                            authorId: 'system',
                            locales: {
                                create: locales.map(locale => ({
                                    locale,
                                    title: article.title,
                                    summary: article.summary,
                                    steps: JSON.stringify(article.steps || []),
                                    success: article.success || '',
                                    caution: article.caution || '',
                                    reviewStatus: locale === 'en' ? 'EDITORIAL_DRAFT' : 'TRANSLATION_REQUIRED'
                                }))
                            }
                        }
                    }
                }
            });

            // Retrieve created revision to create publication
            const rev = await prisma.helpRevision.findFirst({
                where: { articleId: article.id, revisionNumber: 1 }
            });

            if (rev) {
                await prisma.helpPublication.create({
                    data: {
                        articleId: article.id,
                        revisionId: rev.id,
                        approvedLocales: JSON.stringify(['en']),
                        publishedBy: 'system',
                        isCurrent: true
                    }
                });
            }

            createdCount++;
        } else {
            // Update metadata if needed
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
            updatedCount++;
        }
    }

    console.log(`[HELP_SEED] Seeding completed: ${createdCount} created, ${updatedCount} updated.`);
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
