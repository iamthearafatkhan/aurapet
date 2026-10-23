const { powerMonitor } = require('electron');

let wasIdle = false;

function startIdleWatcher(onWelcomeBack) {
    setInterval(() => {
        const idleTime = powerMonitor.getSystemIdleTime();

        // If you have been away for more than 3 minutes (180 seconds)
        if (idleTime > 180 && !wasIdle) {
            wasIdle = true;
        }
        // If you come back (idle time drops to 0-2 seconds)
        else if (idleTime < 3 && wasIdle) {
            wasIdle = false;
            onWelcomeBack();
        }
    }, 5000);
}

module.exports = { startIdleWatcher };