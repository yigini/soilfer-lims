#!/usr/bin/env node
/**
 * SoilFER-LIMS — Database Seed Script
 * 
 * Provisions default users and labs based on DEPLOYMENT_MODE.
 * Safe to run multiple times — skips if data already exists.
 * 
 * Modes:
 *   local  → Single lab + LAB_MANAGER admin account
 *   global → SUPER_ADMIN account (create labs via UI)
 */

const prisma = require('./prisma');
const bcrypt = require('bcryptjs');

const MODE = (process.env.DEPLOYMENT_MODE || 'local').toLowerCase();

async function seed() {
    console.log(`\n🌱 SoilFER-LIMS Seed — Mode: ${MODE.toUpperCase()}\n`);

    // Check if any users exist — skip if already seeded
    const userCount = await prisma.user.count();
    if (userCount > 0) {
        console.log(`✓ Database already has ${userCount} user(s). Skipping seed.`);
        console.log('  To re-seed, delete existing users first.\n');
        return;
    }

    const crypto = require('crypto');
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(6).toString('base64url');
    const defaultPassword = await bcrypt.hash(initialPassword, 10);
    const now = new Date();

    if (MODE === 'global') {
        // ── Global Mode: SUPER_ADMIN only ──
        console.log('📡 Global Mode — Creating Super Admin account...\n');

        await prisma.user.create({
            data: {
                id: `user-admin-${Date.now()}`,
                username: 'admin',
                password: defaultPassword,
                email: 'admin@soilfer-lims.local',
                role: 'SUPER_ADMIN',
                name: 'System Administrator',
                labId: null,
                countries: '[]',
                projects: '[]',
                isActive: true,
                mustChangePassword: true,
                createdAt: now,
                updatedAt: now
            }
        });

        console.log('  ✓ Created user: admin (SUPER_ADMIN)');
        console.log('  ┌────────────────────────────────────────────────────────┐');
        console.log('  │ 🔑 INITIAL ADMIN CREDENTIALS (Generated — Print Once): │');
        console.log(`  │    Username: admin                                     │`);
        console.log(`  │    Password: ${initialPassword.padEnd(42)}│`);
        console.log('  └────────────────────────────────────────────────────────┘');
        console.log('    ⚠ You will be prompted to set a new password on first login.\n');
        console.log('  Next steps:');
        console.log('    1. Log in as admin');
        console.log('    2. Create laboratories via Admin → Laboratories');
        console.log('    3. Create lab managers for each laboratory');
        console.log('    4. Lab managers can then create technicians\n');

    } else {
        // ── Local Mode: LAB_MANAGER + default lab ──
        console.log('🏠 Local Mode — Creating default lab & admin account...\n');

        const labId = `lab-default-${Date.now()}`;

        // Create default laboratory (uses Lab model from schema)
        await prisma.lab.create({
            data: {
                id: labId,
                name: 'My Laboratory',
                code: 'LAB01',
                country: 'INT',
                isActive: true,
                createdAt: now,
                updatedAt: now
            }
        });
        console.log('  ✓ Created laboratory: My Laboratory (LAB01)');

        // Create admin user (LAB_MANAGER scoped to the default lab)
        await prisma.user.create({
            data: {
                id: `user-admin-${Date.now()}`,
                username: 'admin',
                password: defaultPassword,
                email: 'admin@soilfer-lims.local',
                role: 'LAB_MANAGER',
                name: 'Lab Administrator',
                labId: labId,
                countries: '[]',
                projects: '[]',
                isActive: true,
                mustChangePassword: true,
                createdAt: now,
                updatedAt: now
            }
        });

        console.log('  ✓ Created user: admin (LAB_MANAGER)');
        console.log('  ┌────────────────────────────────────────────────────────┐');
        console.log('  │ 🔑 INITIAL ADMIN CREDENTIALS (Generated — Print Once): │');
        console.log(`  │    Username: admin                                     │`);
        console.log(`  │    Password: ${initialPassword.padEnd(42)}│`);
        console.log('  └────────────────────────────────────────────────────────┘');
        console.log('    ⚠ You will be prompted to set a new password on first login.\n');
        console.log('  Next steps:');
        console.log('    1. Log in as admin');
        console.log('    2. Update laboratory details via Settings');
        console.log('    3. Create technician accounts as needed\n');
    }

    // Create default system settings if they don't exist
    const settingsExist = await prisma.systemSetting.count();
    if (settingsExist === 0) {
        await prisma.systemSetting.create({
            data: {
                id: 'global',
                branding: JSON.stringify({
                    title: MODE === 'global' ? 'SoilFER-LIMS Global' : 'SoilFER-LIMS',
                    colors: { primary: '#2563eb', accent: '#8b5cf6' },
                    logoUrl: null
                })
            }
        });
        console.log('  ✓ Created default system settings\n');
    }

    console.log('🎉 Seed complete!\n');
}

seed()
    .catch(err => {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
