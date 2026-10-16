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
 *   node scripts/provision_super_admin.js [--username <username>] [--password <password>] [--email <email>] [--create|--elevate] [--activate]
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
    let username = null;
    let password = null;
    let explicitEmail = null;
    let forceCreate = false;
    let forceElevate = false;
    let allowActivate = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--username' && args[i + 1]) username = args[++i];
        else if (args[i] === '--password' && args[i + 1]) password = args[++i];
        else if (args[i] === '--email' && args[i + 1]) explicitEmail = args[++i];
        else if (args[i] === '--create') forceCreate = true;
        else if (args[i] === '--elevate') forceElevate = true;
        else if (args[i] === '--activate') allowActivate = true;
        else if (!args[i].startsWith('--')) {
            if (!username) username = args[i];
            else if (!password) password = args[i];
        }
    }

    if (!username) {
        username = 'superadmin';
    }

    if (forceCreate && forceElevate) {
        console.error('[PROVISION] ERROR: Cannot specify both --create and --elevate simultaneously.');
        process.exit(1);
    }

    // 1. Look up user by exact username
    const userByUsername = await prisma.user.findUnique({
        where: { username }
    });

    // 2. Candidate email: explicit email if given, otherwise username-scoped default
    const candidateEmail = explicitEmail || (username === 'superadmin' ? 'sysadmin@soilfer-lims.local' : `${username}@soilfer-lims.local`);

    const userByCandidateEmail = await prisma.user.findUnique({
        where: { email: candidateEmail }
    });

    // 3. Collision / Ambiguity Rejection Before Any Mutation
    // Scenario A: Candidate email belongs to a DIFFERENT user
    if (userByCandidateEmail && (!userByUsername || userByCandidateEmail.id !== userByUsername.id)) {
        console.error(`[PROVISION] ERROR: Conflicting identity. The email '${candidateEmail}' is already assigned to a different user ('${userByCandidateEmail.username}', id: ${userByCandidateEmail.id}).`);
        console.error('Halting without making any mutations to prevent cross-account modification.');
        process.exit(1);
    }

    // Scenario B: User exists but --create was requested
    if (userByUsername && forceCreate) {
        console.error(`[PROVISION] ERROR: Cannot create user '${username}': account already exists (Current role: ${userByUsername.role}). Use --elevate to modify an existing account.`);
        process.exit(1);
    }

    // Scenario C: User does NOT exist but --elevate was requested
    if (!userByUsername && forceElevate) {
        console.error(`[PROVISION] ERROR: Cannot elevate user '${username}': account does not exist. Use --create or omit --elevate to provision a new account.`);
        process.exit(1);
    }

    const generatedPassword = password || crypto.randomBytes(8).toString('base64url');
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    const now = new Date();

    if (userByUsername) {
        // --- ELEVATION PATH ---
        console.log(`[PROVISION] Existing user found: ${userByUsername.username} (Current role: ${userByUsername.role}, Active: ${userByUsername.isActive})`);

        // Check active state: preserve inactive status unless --activate was passed
        let newIsActive = userByUsername.isActive;
        if (!userByUsername.isActive) {
            if (allowActivate) {
                newIsActive = true;
                console.log(`[PROVISION] Reactivating inactive user '${userByUsername.username}' as requested by --activate.`);
            } else {
                console.log(`[PROVISION] Preserving INACTIVE status for user '${userByUsername.username}'. (Pass --activate if reactivation is intended.)`);
            }
        }

        // Revoke active sessions by incrementing tokenVersion
        const nextTokenVersion = (userByUsername.tokenVersion || 0) + 1;

        const updateData = {
            role: 'SUPER_ADMIN',
            password: hashedPassword,
            isActive: newIsActive,
            mustChangePassword: true,
            tokenVersion: nextTokenVersion,
            updatedAt: now
        };

        if (explicitEmail && explicitEmail !== userByUsername.email) {
            updateData.email = explicitEmail;
        }

        const updated = await prisma.user.update({
            where: { id: userByUsername.id },
            data: updateData
        });

        console.log(`[PROVISION] Elevated user '${updated.username}' to SUPER_ADMIN (tokenVersion: ${updated.tokenVersion}, Active: ${updated.isActive}).`);

        console.log('\n┌────────────────────────────────────────────────────────┐');
        console.log('│ 🔑 ELEVATED SUPER_ADMIN CREDENTIALS:                   │');
        console.log(`│    Username: ${updated.username.padEnd(42)}│`);
        console.log(`│    Password: ${generatedPassword.padEnd(42)}│`);
        console.log('└────────────────────────────────────────────────────────┘');
        console.log('⚠ Password must be changed upon next login.\n');
    } else {
        // --- CREATION PATH ---
        const newUser = await prisma.user.create({
            data: {
                id: `user-superadmin-${Date.now()}`,
                username,
                password: hashedPassword,
                email: candidateEmail,
                role: 'SUPER_ADMIN',
                name: 'System Super Administrator',
                labId: null,
                countries: '[]',
                projects: '[]',
                isActive: true,
                mustChangePassword: true,
                tokenVersion: 0,
                createdAt: now,
                updatedAt: now
            }
        });
        console.log(`[PROVISION] Created new SUPER_ADMIN user: ${newUser.username} (${candidateEmail})`);

        console.log('\n┌────────────────────────────────────────────────────────┐');
        console.log('│ 🔑 PROVISIONED SUPER_ADMIN CREDENTIALS:                │');
        console.log(`│    Username: ${newUser.username.padEnd(42)}│`);
        console.log(`│    Password: ${generatedPassword.padEnd(42)}│`);
        console.log('└────────────────────────────────────────────────────────┘');
        console.log('⚠ Password must be changed upon first login.\n');
    }
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
