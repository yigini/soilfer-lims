const express = require('express');
const jwt = require('jsonwebtoken');

// Inject only the owned SQLite connection. Routes, token validation, scope,
// permissions and every QC service remain the actual application code.
async function withQcRunHttp(db, actor, exercise, { reports = false } = {}) {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'qc-run-owned-http-contract-secret';
    try {
        await jest.isolateModulesAsync(async () => {
            jest.doMock('../../prisma', () => db);
            const app = express();
            app.use(express.json());
            app.use('/api/qc', require('../../routes/qcRoutes'));
            if (reports) app.use('/api/reports', require('../../routes/reportRoutes'));
            const token = jwt.sign({ id: actor.id || actor.username, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });
            await exercise(app, token);
        });
    } finally {
        jest.dontMock('../../prisma');
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    }
}
module.exports = { withQcRunHttp };
