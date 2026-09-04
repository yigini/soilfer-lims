const path = require('path');
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4 } = require('crypto');

let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {
    Database = require(path.join(__dirname, 'node_modules/better-sqlite3'));
}

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'prisma/dev.db');
const db = new Database(dbPath, { timeout: 5000 });

// Enable foreign keys, WAL mode, busy_timeout, and synchronous NORMAL
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

const usersDb = {
    create: (user) => {
        const id = user.id || uuidv4();
        const username = user.username;
        const passwordHash = user.password 
            ? (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') ? user.password : bcrypt.hashSync(user.password, 10)) 
            : bcrypt.hashSync('password', 10);
        const role = user.role || 'LAB_TECHNICIAN';
        const labId = user.labId || null;
        const countries = user.countries ? JSON.stringify(user.countries) : '[]';
        const projects = user.projects ? JSON.stringify(user.projects) : '[]';
        const permissions = user.permissions ? JSON.stringify(user.permissions) : '[]';
        const name = user.name || username;
        const email = user.email || `${username}@soilfer.org`;
        const mustChangePassword = user.mustChangePassword !== undefined ? (user.mustChangePassword ? 1 : 0) : 0;

        const stmt = db.prepare(`
            INSERT INTO User (id, username, password, role, labId, countries, projects, name, email, isActive, mustChangePassword, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(username) DO UPDATE SET
                role = excluded.role,
                labId = excluded.labId,
                countries = excluded.countries,
                projects = excluded.projects,
                updatedAt = CURRENT_TIMESTAMP
        `);
        stmt.run(id, username, passwordHash, role, labId, countries, projects, name, email, mustChangePassword);

        return {
            id,
            username,
            role,
            labId,
            countries: Array.isArray(user.countries) ? user.countries : [],
            projects: Array.isArray(user.projects) ? user.projects : [],
            permissions: Array.isArray(user.permissions) ? user.permissions : []
        };
    },
    findByUsername: (username) => {
        const row = db.prepare('SELECT * FROM User WHERE username = ?').get(username);
        if (!row) return null;
        return {
            ...row,
            countries: row.countries ? JSON.parse(row.countries) : [],
            projects: row.projects ? JSON.parse(row.projects) : [],
            permissions: []
        };
    },
    getAll: () => {
        return db.prepare('SELECT * FROM User').all().map(row => ({
            ...row,
            countries: row.countries ? JSON.parse(row.countries) : [],
            projects: row.projects ? JSON.parse(row.projects) : [],
            permissions: []
        }));
    },
    delete: (username) => {
        db.prepare('DELETE FROM User WHERE username = ?').run(username);
    }
};

const samplesDb = {
    create: (sample) => {
        const id = sample.id || `SMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const labId = sample.labId || id;
        const originalId = sample.originalId || sample.labId || id;
        const assignedLab = sample.assignedLab || sample.labId || 'LAB-DEFAULT';
        const status = sample.status || 'RECEIVED';
        const submitter = sample.submitter || 'Test Submitter';
        const countryName = sample.countryName || sample.countryCode || 'GTM';
        const countryCode = sample.countryCode || 'GTM';
        const projectCode = sample.projectCode || 'SOILFER-US';
        const dryingStatus = sample.dryingStatus || 'DONE';
        const preparationStatus = sample.preparationStatus || 'DONE';
        const receptionDate = sample.receptionDate || new Date().toISOString();
        const requiredAnalyses = sample.analyses ? JSON.stringify(sample.analyses) : (sample.requiredAnalyses ? JSON.stringify(sample.requiredAnalyses) : null);
        const metadata = sample.metadata ? (typeof sample.metadata === 'string' ? sample.metadata : JSON.stringify(sample.metadata)) : '{}';
        const history = sample.history ? (typeof sample.history === 'string' ? sample.history : JSON.stringify(sample.history)) : '[]';

        // Clean upsert to prevent FK delete issues
        const existing = db.prepare('SELECT id FROM Sample WHERE id = ? OR originalId = ?').get(id, originalId);
        if (existing) {
            const stmt = db.prepare(`
                UPDATE Sample SET
                    labId = ?, originalId = ?, assignedLab = ?, status = ?, countryName = ?, country = ?,
                    projectCode = ?, dryingStatus = ?, preparationStatus = ?, receptionDate = ?, requiredAnalyses = ?,
                    metadata = ?, history = ?, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            stmt.run(
                labId, originalId, assignedLab, status, countryName, countryCode,
                projectCode, dryingStatus, preparationStatus, receptionDate, requiredAnalyses,
                metadata, history, existing.id
            );
            return samplesDb.findById(existing.id);
        } else {
            const stmt = db.prepare(`
                INSERT INTO Sample (
                    id, labId, originalId, assignedLab, status, countryName, country,
                    projectCode, dryingStatus, preparationStatus, receptionDate, requiredAnalyses,
                    metadata, history, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `);
            stmt.run(
                id, labId, originalId, assignedLab, status, countryName, countryCode,
                projectCode, dryingStatus, preparationStatus, receptionDate, requiredAnalyses,
                metadata, history
            );
        }

        return {
            id,
            labId,
            originalId,
            assignedLab,
            status,
            submitter,
            countryName,
            countryCode,
            projectCode,
            dryingStatus,
            preparationStatus,
            receptionDate,
            requiredAnalyses
        };
    },
    findById: (id) => {
        const row = db.prepare('SELECT * FROM Sample WHERE id = ?').get(id);
        if (!row) return null;
        const meta = row.metadata ? JSON.parse(row.metadata) : {};
        return {
            ...row,
            archiveLocation: meta.archiveLocation || row.archiveLocation,
            disposalMethod: meta.disposalMethod || row.disposalMethod,
            requiredAnalyses: row.requiredAnalyses ? JSON.parse(row.requiredAnalyses) : [],
            metadata: meta,
            history: row.history ? JSON.parse(row.history) : []
        };
    },
    getAll: () => {
        return db.prepare('SELECT * FROM Sample').all().map(row => ({
            ...row,
            requiredAnalyses: row.requiredAnalyses ? JSON.parse(row.requiredAnalyses) : [],
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            history: row.history ? JSON.parse(row.history) : []
        }));
    },
    update: (id, updates) => {
        const fields = [];
        const values = [];
        for (const [k, v] of Object.entries(updates)) {
            fields.push(`${k} = ?`);
            values.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
        }
        values.push(id);
        db.prepare(`UPDATE Sample SET ${fields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
        return samplesDb.findById(id);
    }
};

const workItemsDb = {
    create: (wi) => {
        const id = wi.id || `WI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const sampleId = wi.sampleId;
        const analysis = wi.analysis || 'PH_H2O';
        const status = wi.status || 'PENDING';
        const assignedTo = wi.assignedTo || null;
        const assignedLab = wi.assignedLab || 'LAB-DEFAULT';
        const batchId = wi.batchId || null;
        const result = wi.result !== undefined ? String(wi.result) : null;
        const history = wi.history ? (typeof wi.history === 'string' ? wi.history : JSON.stringify(wi.history)) : '[]';

        // Auto-ensure parent sample exists to satisfy foreign key
        if (sampleId) {
            const sampleExists = db.prepare('SELECT id FROM Sample WHERE id = ?').get(sampleId);
            if (!sampleExists) {
                samplesDb.create({ id: sampleId, originalId: sampleId, labId: sampleId, assignedLab });
            }
        }

        const existing = db.prepare('SELECT id FROM WorkItem WHERE id = ?').get(id);
        if (existing) {
            const stmt = db.prepare(`
                UPDATE WorkItem SET
                    sampleId = ?, analysis = ?, status = ?, assignedTo = ?, assignedLab = ?, batchId = ?, result = ?, history = ?, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            stmt.run(sampleId, analysis, status, assignedTo, assignedLab, batchId, result, history, id);
            return workItemsDb.findById(id);
        } else {
            const stmt = db.prepare(`
                INSERT INTO WorkItem (
                    id, sampleId, analysis, status, assignedTo, assignedLab, batchId, result, history, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `);
            stmt.run(id, sampleId, analysis, status, assignedTo, assignedLab, batchId, result, history);
        }

        return {
            id,
            sampleId,
            analysis,
            status,
            assignedTo,
            assignedLab,
            batchId,
            result
        };
    },
    findById: (id) => {
        const row = db.prepare('SELECT * FROM WorkItem WHERE id = ?').get(id);
        if (!row) return null;
        return {
            ...row,
            history: row.history ? JSON.parse(row.history) : []
        };
    },
    getAll: () => {
        return db.prepare('SELECT * FROM WorkItem').all().map(row => ({
            ...row,
            history: row.history ? JSON.parse(row.history) : []
        }));
    },
    update: (id, updates) => {
        const fields = [];
        const values = [];
        for (const [k, v] of Object.entries(updates)) {
            fields.push(`${k} = ?`);
            values.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
        }
        values.push(id);
        db.prepare(`UPDATE WorkItem SET ${fields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
        return workItemsDb.findById(id);
    }
};

const batchesDb = {
    create: (batch) => {
        const id = batch.id || `BATCH-${Date.now()}`;
        const labId = batch.labId || 'LAB-DEFAULT';
        const analysis = batch.analysis || 'PH_H2O';
        const instrument = batch.instrument || null;
        const status = batch.status || 'OPEN';
        const createdBy = batch.createdBy || 'admin';
        const notes = batch.notes || null;
        const qcResults = batch.qcResults ? (typeof batch.qcResults === 'string' ? batch.qcResults : JSON.stringify(batch.qcResults)) : null;
        const workItemIds = batch.workItemIds ? (typeof batch.workItemIds === 'string' ? batch.workItemIds : JSON.stringify(batch.workItemIds)) : '[]';

        const stmt = db.prepare(`
            INSERT INTO Batch (
                id, labId, analysis, instrument, status, createdBy, notes, qcResults, workItemIds, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                qcResults = excluded.qcResults,
                workItemIds = excluded.workItemIds
        `);
        stmt.run(id, labId, analysis, instrument, status, createdBy, notes, qcResults, workItemIds);

        return {
            id,
            labId,
            analysis,
            instrument,
            status,
            createdBy,
            notes
        };
    },
    findById: (id) => {
        const row = db.prepare('SELECT * FROM Batch WHERE id = ?').get(id);
        if (!row) return null;
        return {
            ...row,
            qcResults: row.qcResults ? JSON.parse(row.qcResults) : null,
            workItemIds: row.workItemIds ? JSON.parse(row.workItemIds) : []
        };
    },
    getAll: () => {
        return db.prepare('SELECT * FROM Batch').all().map(row => ({
            ...row,
            qcResults: row.qcResults ? JSON.parse(row.qcResults) : null,
            workItemIds: row.workItemIds ? JSON.parse(row.workItemIds) : []
        }));
    }
};

const submissionsDb = {
    create: (sub) => {
        const id = sub.id || `SUB-${Date.now()}`;
        const sampleId = sub.sampleId;
        const labId = sub.labId || 'LAB-DEFAULT';
        const assignedLab = sub.assignedLab || labId;
        const type = sub.type || 'PARTIAL';
        const status = sub.status || 'PENDING_REVIEW';
        const submittedBy = sub.submittedBy || 'admin';
        const workItemIds = sub.workItemIds ? (typeof sub.workItemIds === 'string' ? sub.workItemIds : JSON.stringify(sub.workItemIds)) : '[]';
        const workItemCount = sub.workItemCount || (Array.isArray(sub.workItemIds) ? sub.workItemIds.length : 0);

        if (submittedBy) {
            const userExists = db.prepare('SELECT id FROM User WHERE username = ?').get(submittedBy);
            if (!userExists) {
                usersDb.create({ username: submittedBy, role: 'LAB_TECHNICIAN', labId: assignedLab });
            }
        }

        if (sampleId) {
            const sampleExists = db.prepare('SELECT id FROM Sample WHERE id = ?').get(sampleId);
            if (!sampleExists) {
                samplesDb.create({ id: sampleId, originalId: sampleId, labId: sampleId, assignedLab });
            }
        }

        const stmt = db.prepare(`
            INSERT INTO Submission (
                id, sampleId, labId, assignedLab, type, status, submittedBy, workItemIds, workItemCount, submittedAt, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                updatedAt = CURRENT_TIMESTAMP
        `);
        stmt.run(id, sampleId, labId, assignedLab, type, status, submittedBy, workItemIds, workItemCount);

        return {
            id,
            sampleId,
            labId,
            assignedLab,
            type,
            status,
            submittedBy,
            workItemIds: Array.isArray(sub.workItemIds) ? sub.workItemIds : []
        };
    },
    findById: (id) => {
        const row = db.prepare('SELECT * FROM Submission WHERE id = ?').get(id);
        if (!row) return null;
        return {
            ...row,
            workItemIds: row.workItemIds ? JSON.parse(row.workItemIds) : []
        };
    },
    getAll: () => {
        return db.prepare('SELECT * FROM Submission').all().map(row => ({
            ...row,
            workItemIds: row.workItemIds ? JSON.parse(row.workItemIds) : []
        }));
    }
};

module.exports = {
    usersDb,
    samplesDb,
    workItemsDb,
    batchesDb,
    submissionsDb
};
