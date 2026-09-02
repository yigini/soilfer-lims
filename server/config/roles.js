/**
 * Canonical Roles & Permissions Registry for SoilFER-LIMS
 * Single source of truth for Role-Based Access Control (RBAC).
 */

const ROLES = {
    SUPER_ADMIN: {
        key: 'SUPER_ADMIN',
        displayName: 'Super Administrator',
        description: 'Global cross-lab administration, API key management, and system configuration'
    },
    MASTER_USER: {
        key: 'MASTER_USER',
        displayName: 'National Master User',
        description: 'National multi-lab director / Program lead'
    },
    PROJECT_MANAGER: {
        key: 'PROJECT_MANAGER',
        displayName: 'Project Manager',
        description: 'Project-level sample tracking, reporting, and 3D geospatial visualization'
    },
    LAB_MANAGER: {
        key: 'LAB_MANAGER',
        displayName: 'Laboratory Manager',
        description: 'Laboratory oversight, work item assignment, method configuration, and final result approval'
    },
    SAMPLE_RECEPTION: {
        key: 'SAMPLE_RECEPTION',
        displayName: 'Sample Reception / Intake Officer',
        description: 'Physical sample intake, sample verification, label generation, and batch preparation'
    },
    LAB_TECHNICIAN: {
        key: 'LAB_TECHNICIAN',
        displayName: 'Laboratory Technician',
        description: 'Bench measurement entry, instrument logging, and analytical queue execution'
    },
    SURVEYOR: {
        key: 'SURVEYOR',
        displayName: 'Field Surveyor',
        description: 'Field sampling intake and provenance registration'
    },
    AUDIT_USER: {
        key: 'AUDIT_USER',
        displayName: 'Quality & Audit Officer',
        description: 'Read-only quality assurance, result auditing, and compliance inspection'
    },
    EXTERNAL_VIEWER: {
        key: 'EXTERNAL_VIEWER',
        displayName: 'External Partner / Stakeholder',
        description: 'Read-only result inspection and project data review'
    },
    VIEWER: {
        key: 'VIEWER',
        displayName: 'General Viewer',
        description: 'Read-only viewer'
    }
};

const ALL_ROLES = Object.keys(ROLES);

const ALLOWED_SUB_ROLES = [
    'LAB_TECHNICIAN',
    'SAMPLE_RECEPTION',
    'AUDIT_USER',
    'EXTERNAL_VIEWER',
    'VIEWER',
    'SURVEYOR'
];

/**
 * Exhaustive Permission Matrix
 */
const PERMISSIONS = {
    // Samples
    'VIEW_SAMPLES': [
        'SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER',
        'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR', 'AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'
    ],
    'CREATE_SAMPLE': [
        'SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'SURVEYOR'
    ],
    'RECEIVE_SAMPLE': [
        'SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'
    ],
    'ASSIGN_LAB_ID': [
        'SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'
    ],
    'CHANGE_STATUS': [
        'SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN'
    ],

    // Results & Workbench
    'ENTER_RESULTS': [
        'SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'
    ],
    'APPROVE_RESULTS': [
        'SUPER_ADMIN', 'LAB_MANAGER'
    ],
    'BATCH_APPROVAL': [
        'SUPER_ADMIN', 'LAB_MANAGER'
    ],

    // Inventory
    'VIEW_INVENTORY': [
        'SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER',
        'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'
    ],
    'CONSUME_INVENTORY': [
        'SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'
    ],
    'MANAGE_INVENTORY': [
        'SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'
    ],

    // Equipment
    'VIEW_EQUIPMENT': [
        'SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER',
        'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'AUDIT_USER', 'VIEWER'
    ],
    'MANAGE_EQUIPMENT': [
        'SUPER_ADMIN', 'LAB_MANAGER'
    ],

    // Projects
    'MANAGE_PROJECTS': [
        'SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER'
    ],
    'ARCHIVE_PROJECTS': [
        'SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'
    ],

    // Users
    'MANAGE_USERS': [
        'SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'
    ],

    // System & Analyses Configuration
    'MANAGE_BRANDING': [
        'SUPER_ADMIN'
    ],
    'MANAGE_ANALYSES': [
        'SUPER_ADMIN', 'LAB_MANAGER', 'MASTER_USER'
    ],

    // Reports & Audit
    'GENERATE_REPORT': [
        'SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'AUDIT_USER'
    ],
    'SHARE_REPORT': [
        'SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'
    ],
    'VIEW_AUDIT': [
        'SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'AUDIT_USER'
    ]
};

/**
 * Returns all granted permissions for a given role name.
 */
function getPermissionsForRole(role) {
    if (!role) return [];
    const roleUpper = role.toUpperCase();
    const granted = [];
    for (const [perm, allowedRoles] of Object.entries(PERMISSIONS)) {
        if (allowedRoles.includes(roleUpper)) {
            granted.push(perm);
        }
    }
    return granted;
}

module.exports = {
    ROLES,
    ALL_ROLES,
    ALLOWED_SUB_ROLES,
    PERMISSIONS,
    getPermissionsForRole
};