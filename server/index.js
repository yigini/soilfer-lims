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