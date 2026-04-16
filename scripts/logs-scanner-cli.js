const path = require('node:path');
const {
    listServices,
    loadConfig,
    queryLogs,
    resolveProjectRoot,
    saveConfig,
    scanProject,
} = require('./logs-scanner-core');

function printHelp(io) {
    io.log('Logs Plugin Scanner');
    io.log('');
    io.log('Usage:');
    io.log('  node scanner.js init              - Scan project and generate config');
    io.log('  node scanner.js list              - List all services');
    io.log('  node scanner.js query <service> [lines] [filter] - Query logs');
    io.log('');
    io.log('Examples:');
    io.log('  node scanner.js init');
    io.log('  node scanner.js list');
    io.log('  node scanner.js query orders-api');
    io.log('  node scanner.js query orders-api 100 ERROR');
}

function getConfigFile(pluginRoot) {
    return path.join(pluginRoot, 'config.json');
}

function printMissingConfig(io) {
    io.log('Configuration not found. Run "node scanner.js init" first.');
}

function handleInit(io, pluginRoot, env) {
    io.log('Scanning project...');

    const config = scanProject({
        env,
        projectRoot: resolveProjectRoot({ env, scriptDir: pluginRoot }),
    });

    const configFile = getConfigFile(pluginRoot);
    saveConfig(configFile, config);

    io.log(`Configuration saved to ${configFile}`);
    io.log(`Found ${config.services.length} services.`);
    return 0;
}

function handleList(io, pluginRoot) {
    const config = loadConfig(getConfigFile(pluginRoot));
    if (!config) {
        printMissingConfig(io);
        return 0;
    }

    const summary = listServices(config);

    io.log(`Framework: ${summary.framework}`);
    io.log(`Total services: ${summary.services.length}`);
    io.log('');
    io.log('Services:');
    for (const service of summary.services) {
        io.log(`  - ${service.name} (${service.module}) - port: ${service.port || 'N/A'}`);
    }

    return 0;
}

function handleQuery(io, pluginRoot, env, args) {
    const serviceName = args[1];
    if (!serviceName) {
        io.log('Usage: node scanner.js query <service> [lines] [filter]');
        io.log('Example: node scanner.js query orders-api 100 ERROR');
        return 1;
    }

    const config = loadConfig(getConfigFile(pluginRoot));
    if (!config) {
        printMissingConfig(io);
        return 0;
    }

    const lines = args[2] ? parseInt(args[2], 10) : 50;
    const filter = args[3] || null;
    const result = queryLogs(config, serviceName, { env, filter, lines });

    if (!result.found) {
        io.log(`Service "${serviceName}" not found.`);
        io.log('Available services:');
        for (const name of result.availableServices) {
            io.log(`  - ${name}`);
        }
        return 0;
    }

    if (!result.logFound) {
        io.log(`Log file not found: ${result.logPath}`);
        return 0;
    }

    const suffix = result.filter ? `, filtered: ${result.filter}` : '';
    io.log(`--- Logs from ${result.service.name} (last ${result.lines} lines${suffix}) ---`);
    io.log(result.logLines.join('\n'));
    return 0;
}

function main(options = {}) {
    const argv = options.argv || process.argv.slice(2);
    const io = options.io || console;
    const env = options.env || process.env;
    const pluginRoot = options.pluginRoot || path.resolve(__dirname, '..');
    const command = argv[0];

    let exitCode = 0;

    switch (command) {
        case 'init':
            exitCode = handleInit(io, pluginRoot, env);
            break;
        case 'list':
            exitCode = handleList(io, pluginRoot);
            break;
        case 'query':
            exitCode = handleQuery(io, pluginRoot, env, argv);
            break;
        default:
            printHelp(io);
            break;
    }

    if (require.main === module && exitCode !== 0) {
        process.exit(exitCode);
    }

    return exitCode;
}

module.exports = {
    main,
};
