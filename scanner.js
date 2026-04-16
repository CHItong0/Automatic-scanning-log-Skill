const { main } = require('./scripts/logs-scanner-cli');

process.exitCode = main({ pluginRoot: __dirname });
