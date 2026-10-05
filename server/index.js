const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables independent of working directory:
// 1. process.env (externally supplied, e.g. Docker, CI, process exports) is preserved by dotenv default.
// 2. Project-root .env (canonical location created by setup.sh / .env.example) supplies configuration.
// 3. server/.env (if present) is loaded for backward compatibility without overriding existing variables.
const rootEnv = path.resolve(__dirname, '..', '.env');
const serverEnv = path.resolve(__dirname, '.env');
if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
}
if (fs.existsSync(serverEnv)) {
    dotenv.config({ path: serverEnv });
}
// Direct npm/node startup gets the same fail-closed outcome as Docker, using
// only a read-only gate. No app, scheduler or writable adapter is loaded first.
try {
    const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, 'prisma', 'dev.db');
    const ready = require('./scripts/install_workflow_state_guards').assertWorkflowStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'WORKFLOW_STARTUP_READY', ...ready }));
    const resultsReady = require('./scripts/install_result_attempt_links').assertResultAttemptStartupReady(dbPath);
    console.log(JSON.stringify({ event: 'RESULT_ATTEMPT_STARTUP_READY', ...resultsReady }));
} catch (error) {
    console.error(JSON.stringify({ error: error.code || 'WORKFLOW_STARTUP_REFUSED', message: error.message,
        nextStep: 'Keep the lab stopped and follow docs/audit/1.2-state-machine.md.', differences: error.differences || [] }));
    process.exit(1);
}
const http = require('http');
const app = require('./app');
const wsServer = require('./wsServer');
const { startEscalationScheduler } = require('./services/escalationService');

const PORT = process.env.PORT || 3000;

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
wsServer.init(server);

// Issue #111: Ensure Node.js keep-alive timeout exceeds reverse proxy timeout (Apache/Nginx)
// Default Node keepAliveTimeout is 5000ms. If Apache reuses pooled sockets after 5s of inactivity,
// Node resets the connection, causing AH01102 500 error responses on concurrent bursts.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// SD-14: Start background escalation scheduler (MAP-19)
startEscalationScheduler();

server.listen(PORT, () => {
    console.log(`Enterprise Server running on http://localhost:${PORT}`);
});
