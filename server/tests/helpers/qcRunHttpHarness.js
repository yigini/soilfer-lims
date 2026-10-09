const express = require('express');
const jwt = require('jsonwebtoken');

// Inject only the owned SQLite connection. Routes, token validation, scope,
// permissions and every QC service remain the actual application code.
async function withQcRunHttp(db, actor, exercise, { reports = false, reviews = false, samples = false, repeatCommands = false, nonconformities = false, workbench = false } = {}) {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'qc-run-owned-http-contract-secret';
    try {
        await jest.isolateModulesAsync(async () => {
            jest.doMock('../../prisma', () => db);
            const app = express();
            app.use(express.json());
            app.use('/api/qc', require('../../routes/qcRoutes'));
            if (workbench) app.use('/api/workbench', require('../../routes/workbenchRoutes'));
            if (nonconformities) app.use('/api/nonconformities', require('../../routes/nonconformityRoutes'));
            if (samples) app.use('/api/samples', require('../../middleware/authMiddleware').verifyToken, require('../../routes/sampleRoutes'));
            if (repeatCommands) {
                app.use('/api/work-items', require('../../routes/workRepeatRoutes'));
                app.use('/api/attempts', require('../../routes/workAttemptRoutes'));
                app.use('/api/results', require('../../routes/resultsRoutes'));
            }
            if (reports) app.use('/api/reports', require('../../routes/reportRoutes'));
            if (reviews) {
                app.use('/api/work', require('../../routes/workRoutes'));
                app.use('/api/submissions', require('../../routes/submissionRoutes'));
            }
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
