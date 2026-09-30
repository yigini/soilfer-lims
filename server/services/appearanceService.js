/**
 * SoilFER LIMS - Appearance & Theme Persistence Service
 *
 * Implements authoritative theme and appearance management per WP/sitewide-theme-library-v1:
 * - Public catalogue and public-safe context
 * - Authenticated user appearance resolution
 * - Strict role authority (SUPER_ADMIN global/lab, LAB_MANAGER own lab, other staff accessibility exception)
 * - Revision concurrency and atomic audit logging
 * - Additive persistence preserving legacy themePreference compatibility
 */

const crypto = require('crypto');
const prisma = require('../prisma');
const {
    THEME_ALLOWLIST,
    DEFAULT_THEME_ID,
    DEFAULT_MODE,
    ACCESSIBILITY_THEME_ID,
    SEMANTIC_STATUS,
    isValidThemeId,
    isValidMode,
    isValidModePreference,
    getPublishedThemeList
} = require('../config/themeCatalog');
const { getLabOperationalState } = require('./labLifecycleService');

/**
 * Returns public-safe static catalogue metadata.
 */
function getCatalog() {
    return {
        themes: getPublishedThemeList(),
        defaultThemeId: DEFAULT_THEME_ID,
        defaultMode: DEFAULT_MODE,
        allowlist: THEME_ALLOWLIST,
        semanticStatus: SEMANTIC_STATUS
    };
}

/**
 * Returns public-safe platform appearance for login and public reports.
 * Does not enumerate laboratories or expose credentials.
 */
async function getPublicAppearance() {
    try {
        const globalSetting = await prisma.globalAppearanceSetting.findUnique({
            where: { id: 'global' }
        });

        const themeId = (globalSetting && isValidThemeId(globalSetting.themeId))
            ? globalSetting.themeId
            : DEFAULT_THEME_ID;

        const mode = (globalSetting && isValidMode(globalSetting.defaultMode))
            ? globalSetting.defaultMode
            : DEFAULT_MODE;

        return {
            themeId,
            appearance: mode,
            revision: globalSetting ? globalSetting.revision : 1
        };
    } catch {
        return {
            themeId: DEFAULT_THEME_ID,
            appearance: DEFAULT_MODE,
            revision: 0
        };
    }
}

/**
 * Reads platform global appearance setting (SUPER_ADMIN only).
 */
async function getGlobalAppearance() {
    const globalSetting = await prisma.globalAppearanceSetting.findUnique({
        where: { id: 'global' }
    });

    if (!globalSetting) {
        return {
            id: 'global',
            themeId: DEFAULT_THEME_ID,
            defaultMode: DEFAULT_MODE,
            revision: 0,
            updatedAt: new Date().toISOString(),
            updatedBy: null
        };
    }

    return globalSetting;
}

/**
 * Updates platform global default appearance (SUPER_ADMIN only).
 */
async function updateGlobalAppearance(actor, { themeId, defaultMode, expectedRevision } = {}) {
    if (!actor || actor.role !== 'SUPER_ADMIN') {
        const err = new Error('Only SUPER_ADMIN can configure platform-wide appearance defaults.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_GLOBAL_APPEARANCE';
        throw err;
    }

    if (!themeId || !isValidThemeId(themeId)) {
        const err = new Error(`Invalid themeId: ${themeId}. Must be one of: ${THEME_ALLOWLIST.join(', ')}`);
        err.statusCode = 400;
        err.code = 'INVALID_THEME_ID';
        throw err;
    }

    if (!defaultMode || !isValidMode(defaultMode)) {
        const err = new Error(`Invalid defaultMode: ${defaultMode}. Must be "light" or "dark".`);
        err.statusCode = 400;
        err.code = 'INVALID_DEFAULT_MODE';
        throw err;
    }

    return await prisma.$transaction(async (tx) => {
        const current = await tx.globalAppearanceSetting.findUnique({
            where: { id: 'global' }
        });

        const currentRevision = current ? current.revision : 0;

        if (expectedRevision !== undefined && expectedRevision !== null && expectedRevision !== currentRevision) {
            const err = new Error(`Revision conflict: expected revision ${expectedRevision} but current revision is ${currentRevision}.`);
            err.statusCode = 409;
            err.code = 'REVISION_CONFLICT';
            err.currentRevision = currentRevision;
            throw err;
        }

        const newRevision = currentRevision + 1;
        const updated = await tx.globalAppearanceSetting.upsert({
            where: { id: 'global' },
            create: {
                id: 'global',
                themeId,
                defaultMode,
                revision: newRevision,
                updatedBy: actor.username || actor.id
            },
            update: {
                themeId,
                defaultMode,
                revision: newRevision,
                updatedBy: actor.username || actor.id
            }
        });

        // Record Audit Event
        await tx.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'GLOBAL_APPEARANCE',
                entityId: 'global',
                action: 'UPDATE_GLOBAL_THEME',
                performedBy: actor.username || actor.id,
                performedByName: actor.name || actor.username,
                before: current ? JSON.stringify({ themeId: current.themeId, defaultMode: current.defaultMode, revision: current.revision }) : null,
                after: JSON.stringify({ themeId: updated.themeId, defaultMode: updated.defaultMode, revision: updated.revision }),
                details: `Updated platform appearance default to ${themeId} (${defaultMode}) at revision ${newRevision}`
            }
        });

        return updated;
    });
}

/**
 * Reads laboratory appearance default setting.
 */
async function getLabAppearance(labId) {
    if (!labId) {
        const err = new Error('labId is required');
        err.statusCode = 400;
        err.code = 'MISSING_LAB_ID';
        throw err;
    }

    const lab = await prisma.lab.findUnique({
        where: { id: labId },
        select: { id: true, name: true, code: true, isActive: true }
    });

    if (!lab) {
        const err = new Error(`Laboratory not found: ${labId}`);
        err.statusCode = 404;
        err.code = 'LAB_NOT_FOUND';
        throw err;
    }

    const setting = await prisma.labAppearanceSetting.findUnique({
        where: { labId }
    });

    return {
        labId: lab.id,
        labName: lab.name,
        labCode: lab.code,
        themeId: setting ? setting.themeId : null,
        defaultMode: setting ? setting.defaultMode : 'inherit',
        revision: setting ? setting.revision : 0,
        updatedAt: setting ? setting.updatedAt : null,
        updatedBy: setting ? setting.updatedBy : null
    };
}

/**
 * Updates laboratory default appearance.
 * Authority: LAB_MANAGER for own lab, or SUPER_ADMIN for any authorized lab.
 */
async function updateLabAppearance(actor, labId, { themeId, defaultMode, expectedRevision } = {}) {
    if (!actor) {
        const err = new Error('Authentication required');
        err.statusCode = 401;
        err.code = 'UNAUTHORIZED';
        throw err;
    }

    if (!labId) {
        const err = new Error('labId is required');
        err.statusCode = 400;
        err.code = 'MISSING_LAB_ID';
        throw err;
    }

    // Role check
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const isOwnLabManager = actor.role === 'LAB_MANAGER' && actor.labId === labId;

    if (!isSuperAdmin && !isOwnLabManager) {
        const err = new Error('Forbidden: You can only configure appearance defaults for your own assigned laboratory.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_LAB_APPEARANCE';
        throw err;
    }

    const lab = await prisma.lab.findUnique({
        where: { id: labId },
        select: { id: true, name: true, code: true, isActive: true }
    });

    if (!lab) {
        const err = new Error(`Laboratory not found: ${labId}`);
        err.statusCode = 404;
        err.code = 'LAB_NOT_FOUND';
        throw err;
    }

    // Lab operational lifecycle check
    const opState = await getLabOperationalState(labId);
    if (opState.operationalStatus === 'RETIRED' || opState.operationalStatus === 'ARCHIVED') {
        const err = new Error(`Cannot modify appearance for retired or archived laboratory ${labId} (status: ${opState.operationalStatus}).`);
        err.statusCode = 409;
        err.code = 'LAB_LIFECYCLE_INACTIVE';
        throw err;
    }

    // Validate themeId: null (reset to inherit platform) or published ID
    if (themeId !== null && themeId !== undefined && !isValidThemeId(themeId)) {
        const err = new Error(`Invalid themeId: ${themeId}. Must be null (to inherit) or one of: ${THEME_ALLOWLIST.join(', ')}`);
        err.statusCode = 400;
        err.code = 'INVALID_THEME_ID';
        throw err;
    }

    // Validate defaultMode: 'inherit' | 'light' | 'dark'
    const targetMode = defaultMode || 'inherit';
    if (!isValidModePreference(targetMode)) {
        const err = new Error(`Invalid defaultMode: ${targetMode}. Must be "inherit", "light", or "dark".`);
        err.statusCode = 400;
        err.code = 'INVALID_DEFAULT_MODE';
        throw err;
    }

    return await prisma.$transaction(async (tx) => {
        const current = await tx.labAppearanceSetting.findUnique({
            where: { labId }
        });

        const currentRevision = current ? current.revision : 0;

        if (expectedRevision !== undefined && expectedRevision !== null && expectedRevision !== currentRevision) {
            const err = new Error(`Revision conflict: expected revision ${expectedRevision} but current revision is ${currentRevision}.`);
            err.statusCode = 409;
            err.code = 'REVISION_CONFLICT';
            err.currentRevision = currentRevision;
            throw err;
        }

        const newRevision = currentRevision + 1;
        const normalizedThemeId = themeId === undefined ? (current ? current.themeId : null) : themeId;

        const updated = await tx.labAppearanceSetting.upsert({
            where: { labId },
            create: {
                labId,
                themeId: normalizedThemeId,
                defaultMode: targetMode,
                revision: newRevision,
                updatedBy: actor.username || actor.id
            },
            update: {
                themeId: normalizedThemeId,
                defaultMode: targetMode,
                revision: newRevision,
                updatedBy: actor.username || actor.id
            }
        });

        // Record Audit Event
        await tx.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'LAB_APPEARANCE',
                entityId: labId,
                labId,
                action: 'UPDATE_LAB_THEME',
                performedBy: actor.username || actor.id,
                performedByName: actor.name || actor.username,
                before: current ? JSON.stringify({ themeId: current.themeId, defaultMode: current.defaultMode, revision: current.revision }) : null,
                after: JSON.stringify({ themeId: updated.themeId, defaultMode: updated.defaultMode, revision: updated.revision }),
                details: `Updated lab ${labId} appearance default to theme=${normalizedThemeId || 'inherit'}, mode=${targetMode} at revision ${newRevision}`
            }
        });

        return updated;
    });
}

/**
 * Returns full appearance context for the authenticated user,
 * resolving personal preferences, lab defaults, and platform defaults.
 */
async function getUserAppearanceContext(actor, queryLabId = null) {
    if (!actor || !actor.id) {
        const publicApp = await getPublicAppearance();
        return {
            effective: {
                themeId: publicApp.themeId,
                appearance: publicApp.appearance,
                themeSource: 'default',
                modeSource: 'default'
            },
            personal: null,
            labDefault: null,
            platformDefault: {
                themeId: publicApp.themeId,
                defaultMode: publicApp.appearance,
                revision: publicApp.revision
            },
            scope: {
                userId: 'anonymous',
                role: 'ANONYMOUS',
                labId: null
            },
            canAdoptLabDefault: false,
            canAdoptPlatformDefault: false
        };
    }

    // 1. Fetch fresh user record from database
    const user = await prisma.user.findUnique({
        where: { id: String(actor.id) },
        select: {
            id: true,
            username: true,
            role: true,
            labId: true,
            themePreference: true,
            uiThemeId: true,
            uiModePreference: true,
            uiAppearanceRevision: true
        }
    });

    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }

    // 2. Fetch platform global default
    const globalSetting = await prisma.globalAppearanceSetting.findUnique({
        where: { id: 'global' }
    });

    const platformThemeId = (globalSetting && isValidThemeId(globalSetting.themeId))
        ? globalSetting.themeId
        : DEFAULT_THEME_ID;

    const platformMode = (globalSetting && isValidMode(globalSetting.defaultMode))
        ? globalSetting.defaultMode
        : DEFAULT_MODE;

    const platformRevision = globalSetting ? globalSetting.revision : 1;

    // 3. Resolve lab scope:
    // If SUPER_ADMIN explicitly passed a valid queryLabId, use it for presentation context.
    // For other users, use their assigned user.labId.
    let targetLabId = null;
    if (user.role === 'SUPER_ADMIN') {
        if (queryLabId && typeof queryLabId === 'string') {
            targetLabId = queryLabId;
        }
    } else {
        targetLabId = user.labId || null;
    }

    let labSetting = null;
    if (targetLabId) {
        const labRecord = await prisma.lab.findUnique({
            where: { id: targetLabId },
            select: { id: true, name: true, code: true, isActive: true }
        });

        if (labRecord) {
            const rawLabSetting = await prisma.labAppearanceSetting.findUnique({
                where: { labId: targetLabId }
            });
            labSetting = {
                labId: labRecord.id,
                labName: labRecord.name,
                labCode: labRecord.code,
                themeId: rawLabSetting?.themeId || null,
                defaultMode: rawLabSetting?.defaultMode || 'inherit',
                revision: rawLabSetting?.revision || 0
            };
        }
    }

    // 4. Resolve effective theme according to strict precedence:
    // User personal theme -> Lab default theme -> Platform default theme -> SoilFER Classic
    let effectiveThemeId = null;
    let themeSource = 'default';

    if (isValidThemeId(user.uiThemeId)) {
        effectiveThemeId = user.uiThemeId;
        themeSource = 'saved';
    } else if (labSetting && isValidThemeId(labSetting.themeId)) {
        effectiveThemeId = labSetting.themeId;
        themeSource = 'labDefault';
    } else if (isValidThemeId(platformThemeId)) {
        effectiveThemeId = platformThemeId;
        themeSource = 'platformDefault';
    } else {
        effectiveThemeId = DEFAULT_THEME_ID;
        themeSource = 'default';
    }

    // 5. Resolve effective mode according to strict precedence:
    // User personal mode (if not inherit) -> Lab default mode (if not inherit) -> Platform default mode -> Light
    let effectiveMode = null;
    let modeSource = 'default';

    const userModePref = user.uiModePreference;
    if (isValidMode(userModePref)) {
        effectiveMode = userModePref;
        modeSource = 'saved';
    } else if (labSetting && isValidMode(labSetting.defaultMode)) {
        effectiveMode = labSetting.defaultMode;
        modeSource = 'labDefault';
    } else if (isValidMode(platformMode)) {
        effectiveMode = platformMode;
        modeSource = 'platformDefault';
    } else {
        effectiveMode = DEFAULT_MODE;
        modeSource = 'default';
    }

    const canAdoptLabDefault = (user.role === 'SUPER_ADMIN' || (user.role === 'LAB_MANAGER' && !!user.labId));
    const canAdoptPlatformDefault = (user.role === 'SUPER_ADMIN');

    return {
        effective: {
            themeId: effectiveThemeId,
            appearance: effectiveMode,
            themeSource,
            modeSource
        },
        personal: {
            themeId: user.uiThemeId,
            modePreference: user.uiModePreference,
            legacyThemePreference: user.themePreference,
            revision: user.uiAppearanceRevision
        },
        labDefault: labSetting,
        platformDefault: {
            themeId: platformThemeId,
            defaultMode: platformMode,
            revision: platformRevision
        },
        scope: {
            userId: user.id,
            role: user.role,
            labId: targetLabId
        },
        canAdoptLabDefault,
        canAdoptPlatformDefault
    };
}

/**
 * Updates user self-service preferences: appearance and language.
 * Enforces role restrictions: ordinary staff can only set null (inherit) or 'clear-contrast'.
 */
async function updateSelfPreferences(actor, { appearance, themePreference, language } = {}) {
    if (!actor || !actor.id) {
        const err = new Error('Authentication required');
        err.statusCode = 401;
        err.code = 'UNAUTHORIZED';
        throw err;
    }

    const user = await prisma.user.findUnique({
        where: { id: String(actor.id) }
    });

    if (!user) {
        const err = new Error('User not found');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }

    const updateData = {};
    const isPrivileged = user.role === 'SUPER_ADMIN' || user.role === 'LAB_MANAGER';

    // Handle appearance object (v2)
    if (appearance !== undefined) {
        if (typeof appearance !== 'object' || appearance === null) {
            const err = new Error('appearance must be an object');
            err.statusCode = 400;
            err.code = 'INVALID_APPEARANCE_PAYLOAD';
            throw err;
        }

        const { themeId, modePreference, expectedRevision } = appearance;

        // Concurrency check
        if (expectedRevision !== undefined && expectedRevision !== null && expectedRevision !== user.uiAppearanceRevision) {
            const err = new Error(`Revision conflict: expected revision ${expectedRevision} but current revision is ${user.uiAppearanceRevision}.`);
            err.statusCode = 409;
            err.code = 'REVISION_CONFLICT';
            err.currentRevision = user.uiAppearanceRevision;
            throw err;
        }

        // Validate themeId
        if (themeId !== undefined) {
            if (themeId === null) {
                updateData.uiThemeId = null;
            } else if (!isValidThemeId(themeId)) {
                const err = new Error(`Invalid themeId: ${themeId}`);
                err.statusCode = 400;
                err.code = 'INVALID_THEME_ID';
                throw err;
            } else {
                // Non-privileged users can ONLY select Clear Contrast (the accessibility theme)
                if (!isPrivileged && themeId !== ACCESSIBILITY_THEME_ID) {
                    const err = new Error('Staff accounts inherit laboratory or platform themes. Only Clear Contrast is available as a personal accessibility override.');
                    err.statusCode = 403;
                    err.code = 'FORBIDDEN_THEME_SELECTION';
                    throw err;
                }
                updateData.uiThemeId = themeId;
            }
        }

        // Validate modePreference
        if (modePreference !== undefined) {
            if (!isValidModePreference(modePreference)) {
                const err = new Error(`Invalid modePreference: ${modePreference}. Must be "inherit", "light", or "dark".`);
                err.statusCode = 400;
                err.code = 'INVALID_MODE_PREFERENCE';
                throw err;
            }
            updateData.uiModePreference = modePreference;

            // Also synchronize legacy themePreference if explicit light or dark
            if (modePreference === 'light' || modePreference === 'dark') {
                updateData.themePreference = modePreference;
            }
        }

        // Check for conflicting legacy themePreference parameter in the same request
        if (themePreference !== undefined && modePreference !== undefined && modePreference !== 'inherit' && themePreference !== modePreference) {
            const err = new Error(`Conflicting mode values: appearance.modePreference="${modePreference}" but legacy themePreference="${themePreference}".`);
            err.statusCode = 400;
            err.code = 'CONFLICTING_THEME_PARAMETERS';
            throw err;
        }

        updateData.uiAppearanceRevision = user.uiAppearanceRevision + 1;
    } else if (themePreference !== undefined) {
        // Pure legacy themePreference update
        if (!['light', 'dark'].includes(themePreference)) {
            const err = new Error('Theme preference must be strictly "light" or "dark"');
            err.statusCode = 400;
            err.code = 'INVALID_THEME_PREFERENCE';
            throw err;
        }
        updateData.themePreference = themePreference;
        updateData.uiModePreference = themePreference;
        updateData.uiAppearanceRevision = user.uiAppearanceRevision + 1;
    }

    // Handle language update
    if (language !== undefined) {
        const { matchSupportedLocale } = require('../utils/localeResolver');
        if (!language || typeof language !== 'string') {
            const err = new Error('Language must be a valid string');
            err.statusCode = 400;
            err.code = 'INVALID_LANGUAGE_PREFERENCE';
            throw err;
        }
        const matched = matchSupportedLocale(language);
        if (!matched) {
            const err = new Error(`Unsupported language: ${language}`);
            err.statusCode = 400;
            err.code = 'INVALID_LANGUAGE_PREFERENCE';
            throw err;
        }
        updateData.language = matched;
    }

    if (Object.keys(updateData).length === 0) {
        const err = new Error('At least one valid preference field must be provided.');
        err.statusCode = 400;
        err.code = 'EMPTY_PAYLOAD';
        throw err;
    }

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        select: {
            id: true,
            username: true,
            language: true,
            themePreference: true,
            uiThemeId: true,
            uiModePreference: true,
            uiAppearanceRevision: true
        }
    });

    return {
        id: updated.id,
        username: updated.username,
        language: updated.language,
        themePreference: updated.themePreference,
        appearance: {
            themeId: updated.uiThemeId,
            modePreference: updated.uiModePreference,
            revision: updated.uiAppearanceRevision
        }
    };
}

module.exports = {
    getCatalog,
    getPublicAppearance,
    getGlobalAppearance,
    updateGlobalAppearance,
    getLabAppearance,
    updateLabAppearance,
    getUserAppearanceContext,
    updateSelfPreferences
};
