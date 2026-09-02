require('dotenv').config();
const http = require('http');
const app = require('./app');
const wsServer = require('./wsServer');
const { startEscalationScheduler } = require('./services/escalationService');

const PORT = process.env.PORT || 3000;

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
wsServer.init(server);

// SD-14: Start background escalation scheduler (MAP-19)
startEscalationScheduler();

server.listen(PORT, () => {
    console.log(`Enterprise Server running on http://localhost:${PORT}`);
});