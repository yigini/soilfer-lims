const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');

/**
 * WP-36: Declarative Deployment Profiles Seeder
 * 
 * Ingests pure JSON deployment configurations:
 * - Laboratories and country associations
 * - Projects, targets, and assigned laboratories
 * - System branding and theme configuration
 * 
 * Strict rule: Profiles must contain JSON data only — no executable code.
 */
async function seedProfile(profileName = 'soilfer', prismaClient = prisma) {
    const profileDir = path.resolve(__dirname, '..', '..', 'profiles', profileName);

    if (!fs.existsSync(profileDir)) {
        throw new Error(`Profile '${profileName}' not found at: ${profileDir}`);
    }

    // Enforce pure data integrity: no code files permitted in profiles
    const files = fs.readdirSync(profileDir);
    const nonJsonFiles = files.filter(f => !f.endsWith('.json'));
    if (nonJsonFiles.length > 0) {
        throw new Error(`Security violation: Profile '${profileName}' contains non-JSON files: ${nonJsonFiles.join(', ')}`);
    }

    console.log(`[PROFILE SEED] Seeding profile: ${profileName} from ${profileDir}`);

    // 1. Seed Laboratories
    const labsPath = path.join(profileDir, 'labs.json');
    let seededLabs = 0;
    if (fs.existsSync(labsPath)) {
        const labs = JSON.parse(fs.readFileSync(labsPath, 'utf8'));
        for (const lab of labs) {
            await prismaClient.lab.upsert({
                where: { id: lab.id },
                update: {
                    name: lab.name,
                    code: lab.code,
                    country: lab.country,
                    isActive: lab.isActive !== false
                },
                create: {
                    id: lab.id,
                    name: lab.name,
                    code: lab.code,
                    country: lab.country,
                    isActive: lab.isActive !== false
                }
            });
            seededLabs++;
        }
        console.log(`  ✓ Seeded ${seededLabs} laboratories`);
    }

    // 2. Seed Projects & Assignments
    const projectsPath = path.join(profileDir, 'projects.json');
    let seededProjects = 0;
    if (fs.existsSync(projectsPath)) {
        const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
        for (const proj of projects) {
            const assignedLabIdsJson = Array.isArray(proj.assignedLabs) ? JSON.stringify(proj.assignedLabs) : (proj.assignedLabIds || null);
            const created = await prismaClient.project.upsert({
                where: { code: proj.code },
                update: {
                    name: proj.name,
                    status: proj.status || 'ACTIVE',
                    projectType: proj.projectType || 'OPEN_INTAKE',
                    expectedSampleCount: proj.expectedSampleCount || 0,
                    assignedLabIds: assignedLabIdsJson
                },
                create: {
                    id: proj.id || proj.code,
                    code: proj.code,
                    name: proj.name,
                    status: proj.status || 'ACTIVE',
                    projectType: proj.projectType || 'OPEN_INTAKE',
                    expectedSampleCount: proj.expectedSampleCount || 0,
                    assignedLabIds: assignedLabIdsJson
                }
            });

            // Assign labs via ProjectLab junction if provided
            if (Array.isArray(proj.assignedLabs)) {
                for (const labId of proj.assignedLabs) {
                    await prismaClient.projectLab.upsert({
                        where: {
                            projectCode_labId: {
                                projectCode: created.code,
                                labId: labId
                            }
                        },
                        update: {},
                        create: {
                            projectCode: created.code,
                            labId: labId
                        }
                    });
                }
            }
            seededProjects++;
        }
        console.log(`  ✓ Seeded ${seededProjects} projects`);
    }

    // 3. Seed Branding
    const brandingPath = path.join(profileDir, 'branding.json');
    if (fs.existsSync(brandingPath)) {
        const brandingData = JSON.parse(fs.readFileSync(brandingPath, 'utf8'));
        await prismaClient.systemSetting.upsert({
            where: { id: 'global' },
            update: {
                branding: JSON.stringify(brandingData)
            },
            create: {
                id: 'global',
                branding: JSON.stringify(brandingData)
            }
        });
        console.log(`  ✓ Applied branding configuration`);
    }

    return {
        profile: profileName,
        seededLabs,
        seededProjects
    };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    let profile = 'soilfer';
    const profileIdx = args.indexOf('--profile');
    if (profileIdx !== -1 && args[profileIdx + 1]) {
        profile = args[profileIdx + 1];
    } else if (process.env.DEPLOYMENT_PROFILE) {
        profile = process.env.DEPLOYMENT_PROFILE;
    }

    seedProfile(profile)
        .then(() => {
            console.log(`\n🎉 Profile seed '${profile}' completed successfully.`);
            process.exit(0);
        })
        .catch(err => {
            console.error('\n❌ Profile seed failed:', err.message);
            process.exit(1);
        });
}

module.exports = { seedProfile };
