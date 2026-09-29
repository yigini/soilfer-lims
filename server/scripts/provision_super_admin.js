#!/usr/bin/env node
/**
 * SoilFER-LIMS — Provision Super Admin CLI
 * 
 * Secure, host-level administrative utility for provisioning or elevating a
 * SUPER_ADMIN account. Used when a single-lab ('local' mode) installation needs
 * to configure system-level integrations (such as GloSIS or OpenNSIS API keys)
 * without improperly granting global permissions to normal LAB_MANAGER accounts.
 *
 * Usage:
 *   node scripts/provision_super_admin.js [--username <username>] [--password <password>] [--email <email>]
 *
 * Example:
 *   node scripts/provision_super_admin.js --username sysadmin
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const rootEnv = path.resolve(__dirname, '..', '..', '.env');
const serverEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv });

const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function provisionSuperAdmin() {
    const args = process.argv.slice(2);
    let username = 'superadmin';
    let password = null;
    let email = 'sysadmin@soilfer-lims.local';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--username' && args[i + 1]) username = args[++i];
        else if (args[i] === '--password' && args[i + 1]) password = args[++i];
        else if (args[i] === '--email' && args[i + 1]) email = args[++i];
        else if (!args[i].startsWith('--')) {
            if (i === 0) username = args[i];
            else if (i === 1) password = args[i];
        }
    }

    const generatedPassword = password || crypto.randomBytes(8).toString('base64url');
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    const now = new Date();

    const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] }
    });

    if (existingUser) {
        console.log(`[PROVISION] Existing user found: ${existingUser.username} (Current role: ${existingUser.role})`);
        const updated = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                role: 'SUPER_ADMIN',
                password: hashedPassword,
                isActive: true,
                mustChangePassword: true,
                updatedAt: now
            }
        });
        console.log(`[PROVISION] Elevated user '${updated.username}' to SUPER_ADMIN with refreshed credentials.`);
    } else {
        const newUser = await prisma.user.create({
            data: {
                id: `user-superadmin-${Date.now()}`,
                username,
                password: hashedPassword,
                email,
                role: 'SUPER_ADMIN',
                name: 'System Super Administrator',
                labId: null,
                countries: '[]',
                projects: '[]',
                isActive: true,
                mustChangePassword: true,
                createdAt: now,
                updatedAt: now
            }
        });
        console.log(`[PROVISION] Created new SUPER_ADMIN user: ${newUser.username}`);
    }

    console.log('\n┌────────────────────────────────────────────────────────┐');
    console.log('│ 🔑 PROVISIONED SUPER_ADMIN CREDENTIALS:                │');
    console.log(`│    Username: ${username.padEnd(42)}│`);
    console.log(`│    Password: ${generatedPassword.padEnd(42)}│`);
    console.log('└────────────────────────────────────────────────────────┘');
    console.log('⚠ Password must be changed upon first login.\n');
}

if (require.main === module) {
    provisionSuperAdmin()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[PROVISION] ERROR:', err.message);
            process.exit(1);
        });
}

module.exports = { provisionSuperAdmin };
