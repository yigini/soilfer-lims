require('dotenv').config();
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