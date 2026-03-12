const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Resolve project root: try to find pom.xml upward from script location
function resolveProjectRoot() {
    // First check environment variable
    if (process.env.PROJECT_ROOT) {
        return process.env.PROJECT_ROOT;
    }

    // Try to find project root by looking for pom.xml from script directory
    let current = __dirname;
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(current, 'pom.xml'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    // Fallback to cwd
    return process.cwd();
}

const PROJECT_ROOT = resolveProjectRoot();
const CONFIG_FILE = path.join(__dirname, 'config.json');

/**
 * Detect project framework type
 * @returns {string} framework name: spring-boot, nodejs, go, python, unknown
 */
function detectFramework() {
    if (fs.existsSync(path.join(PROJECT_ROOT, 'pom.xml'))) {
        return 'spring-boot';
    }
    if (fs.existsSync(path.join(PROJECT_ROOT, 'package.json'))) {
        return 'nodejs';
    }
    if (fs.existsSync(path.join(PROJECT_ROOT, 'go.mod'))) {
        return 'go';
    }
    if (fs.existsSync(path.join(PROJECT_ROOT, 'requirements.txt'))) {
        return 'python';
    }
    return 'unknown';
}

/**
 * Parse pom.xml to get module list
 * @returns {string[]} list of module names
 */
function getModulesFromPom() {
    const pomPath = path.join(PROJECT_ROOT, 'pom.xml');
    if (!fs.existsSync(pomPath)) {
        return [];
    }

    const pomContent = fs.readFileSync(pomPath, 'utf-8');
    const moduleRegex = /<module>([^<]+)<\/module>/g;
    const modules = [];
    let match;
    while ((match = moduleRegex.exec(pomContent)) !== null) {
        modules.push(match[1]);
    }
    return modules;
}

/**
 * Find -biz modules from the project
 * @returns {string[]} list of biz module paths
 */
function findBizModules() {
    const modules = getModulesFromPom();
    const bizModules = [];

    for (const mod of modules) {
        // e.g., aidouxue-module-ai -> aidouxue-module-ai/aidouxue-module-ai-biz
        const bizPath = path.join(PROJECT_ROOT, mod, `${mod}-biz`);
        if (fs.existsSync(bizPath)) {
            bizModules.push(bizPath);
        }
    }

    return bizModules;
}

/**
 * Get application name from application.yaml
 * @param {string} bizModulePath
 * @returns {string|null}
 */
function getApplicationName(bizModulePath) {
    const yamlPath = path.join(bizModulePath, 'src/main/resources/application.yaml');
    if (!fs.existsSync(yamlPath)) {
        return null;
    }

    const content = fs.readFileSync(yamlPath, 'utf-8');
    const match = content.match(/spring:\s+application:\s+name:\s*(\S+)/);
    return match ? match[1] : null;
}

/**
 * Get log file path from logback-spring.xml
 * @param {string} bizModulePath
 * @returns {string|null}
 */
function getLogFilePath(bizModulePath) {
    const logbackPath = path.join(bizModulePath, 'src/main/resources/logback-spring.xml');
    if (!fs.existsSync(logbackPath)) {
        return null;
    }

    const content = fs.readFileSync(logbackPath, 'utf-8');

    // Try to find ${LOG_FILE} pattern first - use string search for reliability
    const logFileTag = '<file>${LOG_FILE}</file>';
    if (content.includes(logFileTag)) {
        // Check application.yaml for logging.file.name
        const yamlPath = path.join(bizModulePath, 'src/main/resources/application.yaml');
        if (fs.existsSync(yamlPath)) {
            const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
            // Handle YAML multiline format with indentation - strip comments, handle CRLF
            const nameMatch = yamlContent.match(/logging:\s*\r?\n\s*file:\s*\r?\n\s*name:\s*([^\s#]+)/);
            if (nameMatch) {
                return nameMatch[1];
            }
            // Try single line format - strip comments
            const simpleMatch = yamlContent.match(/logging:\s+file:\s+name:\s*([^\s#]+)/);
            if (simpleMatch) {
                return simpleMatch[1];
            }
        }
    }

    // Try to find direct file path
    const fileMatch = content.match(/<file>([^$<]+)<\/file>/);
    return fileMatch ? fileMatch[1].trim() : null;
}

/**
 * Get server port from application.yaml
 * @param {string} bizModulePath
 * @returns {number|null}
 */
function getServerPort(bizModulePath) {
    const yamlPath = path.join(bizModulePath, 'src/main/resources/application.yaml');
    if (!fs.existsSync(yamlPath)) {
        return null;
    }

    const content = fs.readFileSync(yamlPath, 'utf-8');
    const match = content.match(/server:\s+port:\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Scan project and generate configuration
 * @returns {Object} configuration object
 */
function scanProject() {
    const framework = detectFramework();
    const services = [];
    const bizModules = findBizModules();

    for (const bizModulePath of bizModules) {
        const moduleName = path.basename(bizModulePath);
        const appName = getApplicationName(bizModulePath) || moduleName;
        const logPath = getLogFilePath(bizModulePath);
        const port = getServerPort(bizModulePath);

        services.push({
            module: moduleName,
            name: appName,
            logPath: logPath || `${process.env.USERPROFILE || process.env.HOME}/logs/${appName}.log`,
            port: port
        });
    }

    // Also scan gateway
    const gatewayPath = path.join(PROJECT_ROOT, 'aidouxue-gateway');
    if (fs.existsSync(gatewayPath)) {
        const appName = getApplicationName(gatewayPath) || 'gateway';
        const logPath = getLogFilePath(gatewayPath);
        const port = getServerPort(gatewayPath);

        services.push({
            module: 'aidouxue-gateway',
            name: appName,
            logPath: logPath || `${process.env.USERPROFILE || process.env.HOME}/logs/${appName}.log`,
            port: port
        });
    }

    return {
        framework,
        projectPath: PROJECT_ROOT,
        services
    };
}

/**
 * Save configuration to file
 * @param {Object} config
 */
function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Load configuration from file
 * @returns {Object|null}
 */
function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

/**
 * List all services
 */
function listServices() {
    const config = loadConfig();
    if (!config) {
        console.log('Configuration not found. Run "node scanner.js init" first.');
        return;
    }

    console.log(`Framework: ${config.framework}`);
    console.log(`Total services: ${config.services.length}`);
    console.log('');
    console.log('Services:');
    for (const svc of config.services) {
        console.log(`  - ${svc.name} (${svc.module}) - port: ${svc.port || 'N/A'}`);
    }
}

/**
 * Query logs for a service
 * @param {string} serviceName
 * @param {number} lines
 * @param {string|null} filter
 */
function queryLogs(serviceName, lines = 50, filter = null) {
    const config = loadConfig();
    if (!config) {
        console.log('Configuration not found. Run "node scanner.js init" first.');
        return;
    }

    const service = config.services.find(s =>
        s.name === serviceName || s.module === serviceName
    );

    if (!service) {
        console.log(`Service "${serviceName}" not found.`);
        console.log('Available services:');
        for (const svc of config.services) {
            console.log(`  - ${svc.name}`);
        }
        return;
    }

    // Expand ~ or ${user.home} or ${spring.application.name} in path
    let logPath = service.logPath;
    const userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Administrator';
    logPath = logPath.replace(/^~(?=\/|\\|$)/, userHome);
    logPath = logPath.replace(/\$\{user\.home\}/g, userHome);
    logPath = logPath.replace(/\$\{spring\.application\.name\}/g, service.name);

    if (!fs.existsSync(logPath)) {
        console.log(`Log file not found: ${logPath}`);
        return;
    }

    try {
        const content = fs.readFileSync(logPath, 'utf-8');
        let logLines = content.split('\n');

        // Get last n lines
        if (lines > 0) {
            logLines = logLines.slice(-lines);
        }

        // Apply filter if provided
        if (filter) {
            const filterLower = filter.toLowerCase();
            logLines = logLines.filter(line => line.toLowerCase().includes(filterLower));
        }

        console.log(`--- Logs from ${service.name} (last ${lines} lines${filter ? ', filtered: ' + filter : ''}) ---`);
        console.log(logLines.join('\n'));
    } catch (err) {
        console.error(`Error reading log file: ${err.message}`);
    }
}

// CLI Entry point
function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'init':
            console.log('Scanning project...');
            const config = scanProject();
            saveConfig(config);
            console.log(`Configuration saved to ${CONFIG_FILE}`);
            console.log(`Found ${config.services.length} services.`);
            break;

        case 'list':
            listServices();
            break;

        case 'query':
            const serviceName = args[1];
            const lines = args[2] ? parseInt(args[2], 10) : 50;
            const filter = args[3] || null;
            if (!serviceName) {
                console.log('Usage: node scanner.js query <service> [lines] [filter]');
                console.log('Example: node scanner.js query ai-server 100 ERROR');
                process.exit(1);
            }
            queryLogs(serviceName, lines, filter);
            break;

        default:
            console.log('Logs Plugin Scanner');
            console.log('');
            console.log('Usage:');
            console.log('  node scanner.js init              - Scan project and generate config');
            console.log('  node scanner.js list              - List all services');
            console.log('  node scanner.js query <service> [lines] [filter] - Query logs');
            console.log('');
            console.log('Examples:');
            console.log('  node scanner.js init');
            console.log('  node scanner.js list');
            console.log('  node scanner.js query ai-server');
            console.log('  node scanner.js query ai-server 100 ERROR');
            break;
    }
}

main();
