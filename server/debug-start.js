
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');

try {
    console.log('Attempting to require app.js...');
    const app = require('./app');
    console.log('App required successfully. If it hangs here, it is listening.');
    setTimeout(() => {
        console.log('Exiting success (timeout)');
        process.exit(0);
    }, 60000);
} catch (e) {
    console.error('Startup Error:', e);
    process.exit(1);
}
