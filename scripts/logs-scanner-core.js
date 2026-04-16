const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SCAN_RULES = {
    projectRootMarkers: ['pom.xml', 'package.json', 'go.mod', 'requirements.txt', 'pyproject.toml'],
    applicationConfigFiles: ['application.yaml', 'application.yml', 'bootstrap.yaml', 'bootstrap.yml'],
    logConfigFiles: ['logback-spring.xml', 'logback.xml'],
    resourceDirectorySegments: ['src', 'main', 'resources'],
    ignoredDirectories: ['.git', '.idea', '.omc', '.omx', '.vscode', 'build', 'coverage', 'dist', 'node_modules', 'target'],
};

function getScanRules(overrides = {}) {
    return {
        projectRootMarkers: overrides.projectRootMarkers || DEFAULT_SCAN_RULES.projectRootMarkers,
        applicationConfigFiles: overrides.applicationConfigFiles || DEFAULT_SCAN_RULES.applicationConfigFiles,
        logConfigFiles: overrides.logConfigFiles || DEFAULT_SCAN_RULES.logConfigFiles,
        resourceDirectorySegments: overrides.resourceDirectorySegments || DEFAULT_SCAN_RULES.resourceDirectorySegments,
        ignoredDirectories: overrides.ignoredDirectories || DEFAULT_SCAN_RULES.ignoredDirectories,
    };
}

function resolveProjectRoot(options = {}) {
    const env = options.env || process.env;
    const rules = getScanRules(options.scanRules);
    const scriptDir = options.scriptDir || __dirname;
    const cwd = options.cwd || process.cwd();
    const maxDepth = options.maxDepth || 5;

    if (env.PROJECT_ROOT) {
        return env.PROJECT_ROOT;
    }

    let current = scriptDir;
    for (let depth = 0; depth < maxDepth; depth += 1) {
        if (rules.projectRootMarkers.some((marker) => fs.existsSync(path.join(current, marker)))) {
            return current;
        }

        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }

        current = parent;
    }

    return cwd;
}

function detectFramework(projectRoot) {
    if (fs.existsSync(path.join(projectRoot, 'pom.xml'))) {
        return 'spring-boot';
    }

    if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
        return 'nodejs';
    }

    if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
        return 'go';
    }

    if (fs.existsSync(path.join(projectRoot, 'requirements.txt')) || fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) {
        return 'python';
    }

    return 'unknown';
}

function readTextIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return fs.readFileSync(filePath, 'utf8');
}

function readDirectoryEntries(directoryPath) {
    try {
        return fs.readdirSync(directoryPath, { withFileTypes: true })
            .sort((left, right) => left.name.localeCompare(right.name));
    } catch {
        return [];
    }
}

function findSequenceIndex(segments, sequence) {
    for (let index = 0; index <= segments.length - sequence.length; index += 1) {
        const matches = sequence.every((segment, offset) => segments[index + offset] === segment);
        if (matches) {
            return index;
        }
    }

    return -1;
}

function deriveServiceRoot(projectRoot, filePath, rules) {
    const relativeDirectory = path.relative(projectRoot, path.dirname(filePath));
    const segments = relativeDirectory.split(path.sep).filter(Boolean);
    const sequenceIndex = findSequenceIndex(segments, rules.resourceDirectorySegments);

    if (sequenceIndex === -1) {
        return path.dirname(filePath);
    }

    const serviceSegments = segments.slice(0, sequenceIndex);
    return serviceSegments.length === 0 ? projectRoot : path.join(projectRoot, ...serviceSegments);
}

function getOrCreateDiscovery(discoveries, serviceRoot) {
    if (!discoveries.has(serviceRoot)) {
        discoveries.set(serviceRoot, {
            serviceRoot,
            applicationConfigPaths: [],
            logConfigPaths: [],
        });
    }

    return discoveries.get(serviceRoot);
}

function registerDiscoveredFile(discoveries, projectRoot, filePath, rules) {
    const fileName = path.basename(filePath);
    const serviceRoot = deriveServiceRoot(projectRoot, filePath, rules);
    const discovery = getOrCreateDiscovery(discoveries, serviceRoot);

    if (rules.applicationConfigFiles.includes(fileName) && !discovery.applicationConfigPaths.includes(filePath)) {
        discovery.applicationConfigPaths.push(filePath);
    }

    if (rules.logConfigFiles.includes(fileName) && !discovery.logConfigPaths.includes(filePath)) {
        discovery.logConfigPaths.push(filePath);
    }
}

function discoverServiceDefinitions(projectRoot, overrides = {}) {
    const rules = getScanRules(overrides);
    const ignoredDirectories = new Set(rules.ignoredDirectories);
    const discoveries = new Map();
    const directoriesToVisit = [projectRoot];

    while (directoriesToVisit.length > 0) {
        const currentDirectory = directoriesToVisit.pop();
        const entries = readDirectoryEntries(currentDirectory);

        for (const entry of entries) {
            const entryPath = path.join(currentDirectory, entry.name);

            if (entry.isDirectory()) {
                if (!ignoredDirectories.has(entry.name)) {
                    directoriesToVisit.push(entryPath);
                }
                continue;
            }

            if (!entry.isFile()) {
                continue;
            }

            if (rules.applicationConfigFiles.includes(entry.name) || rules.logConfigFiles.includes(entry.name)) {
                registerDiscoveredFile(discoveries, projectRoot, entryPath, rules);
            }
        }
    }

    return Array.from(discoveries.values())
        .map((discovery) => ({
            ...discovery,
            applicationConfigPaths: discovery.applicationConfigPaths.sort((left, right) => left.localeCompare(right)),
            logConfigPaths: discovery.logConfigPaths.sort((left, right) => left.localeCompare(right)),
        }))
        .sort((left, right) => left.serviceRoot.localeCompare(right.serviceRoot));
}

function readContentsInOrder(filePaths) {
    return filePaths
        .map((filePath) => readTextIfExists(filePath))
        .filter((content) => content !== null);
}

function extractFirstMatch(contents, patterns) {
    for (const content of contents) {
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                return match[1];
            }
        }
    }

    return null;
}

function getApplicationName(serviceDefinition) {
    const contents = readContentsInOrder(serviceDefinition.applicationConfigPaths);
    return extractFirstMatch(contents, [
        /spring:\s+application:\s+name:\s*(\S+)/,
    ]);
}

function getServerPort(serviceDefinition) {
    const contents = readContentsInOrder(serviceDefinition.applicationConfigPaths);
    const value = extractFirstMatch(contents, [
        /server:\s+port:\s*(\d+)/,
    ]);

    return value ? parseInt(value, 10) : null;
}

function getConfiguredLogPath(serviceDefinition) {
    const applicationContents = readContentsInOrder(serviceDefinition.applicationConfigPaths);
    const configuredPath = extractFirstMatch(applicationContents, [
        /logging:\s*\r?\n\s*file:\s*\r?\n\s*name:\s*([^\s#]+)/,
        /logging:\s+file:\s+name:\s*([^\s#]+)/,
    ]);

    if (configuredPath) {
        return configuredPath;
    }

    const configuredDirectory = extractFirstMatch(applicationContents, [
        /logging:\s*\r?\n\s*file:\s*\r?\n\s*path:\s*([^\s#]+)/,
        /logging:\s+file:\s+path:\s*([^\s#]+)/,
    ]);

    return configuredDirectory ? `${configuredDirectory}/${path.basename(serviceDefinition.serviceRoot)}.log` : null;
}

function getLogFilePath(serviceDefinition) {
    const logConfigContents = readContentsInOrder(serviceDefinition.logConfigPaths);
    const directFile = extractFirstMatch(logConfigContents, [
        /<file>([^$<]+)<\/file>/,
    ]);

    if (directFile) {
        return directFile.trim();
    }

    const usesLogFilePlaceholder = logConfigContents.some((content) => content.includes('<file>${LOG_FILE}</file>'));
    const configuredPath = getConfiguredLogPath(serviceDefinition);

    if (configuredPath) {
        return configuredPath;
    }

    return usesLogFilePlaceholder ? null : null;
}

function getDefaultLogPath(appName, env = process.env) {
    const homeDir = env.USERPROFILE || env.HOME;
    return `${homeDir}/logs/${appName}.log`;
}

function createServiceRecord(serviceDefinition, env = process.env) {
    const moduleName = path.basename(serviceDefinition.serviceRoot);
    const appName = getApplicationName(serviceDefinition) || moduleName;

    return {
        module: moduleName,
        name: appName,
        logPath: getLogFilePath(serviceDefinition) || getDefaultLogPath(appName, env),
        port: getServerPort(serviceDefinition),
    };
}

function scanProject(options = {}) {
    const env = options.env || process.env;
    const projectRoot = options.projectRoot || resolveProjectRoot(options);
    const serviceDefinitions = discoverServiceDefinitions(projectRoot, options.scanRules);
    const services = serviceDefinitions
        .map((definition) => createServiceRecord(definition, env))
        .sort((left, right) => left.name.localeCompare(right.name) || left.module.localeCompare(right.module));

    return {
        framework: detectFramework(projectRoot),
        projectPath: projectRoot,
        services,
    };
}

function saveConfig(configFile, config) {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
}

function loadConfig(configFile) {
    const content = readTextIfExists(configFile);
    return content ? JSON.parse(content) : null;
}

function resolveLogPath(logPath, serviceName, env = process.env) {
    const homeDir = env.USERPROFILE || env.HOME || 'C:\\Users\\Administrator';

    return logPath
        .replace(/^~(?=\/|\\|$)/, homeDir)
        .replace(/\$\{user\.home\}/g, homeDir)
        .replace(/\$\{spring\.application\.name\}/g, serviceName);
}

function findService(config, serviceName) {
    return config.services.find((service) =>
        service.name === serviceName || service.module === serviceName
    ) || null;
}

function listServices(config) {
    return {
        framework: config.framework,
        services: config.services.map((service) => ({
            name: service.name,
            module: service.module,
            port: service.port,
        })),
    };
}

function queryLogs(config, serviceName, options = {}) {
    const service = findService(config, serviceName);
    if (!service) {
        return {
            found: false,
            availableServices: config.services.map((item) => item.name),
        };
    }

    const lines = options.lines ?? 50;
    const filter = options.filter || null;
    const env = options.env || process.env;
    const logPath = resolveLogPath(service.logPath, service.name, env);

    if (!fs.existsSync(logPath)) {
        return {
            found: true,
            logFound: false,
            service,
            logPath,
        };
    }

    let logLines = fs.readFileSync(logPath, 'utf8').split('\n');
    if (lines > 0) {
        logLines = logLines.slice(-lines);
    }

    if (filter) {
        const keyword = filter.toLowerCase();
        logLines = logLines.filter((line) => line.toLowerCase().includes(keyword));
    }

    return {
        found: true,
        logFound: true,
        service,
        logPath,
        lines,
        filter,
        logLines,
    };
}

module.exports = {
    DEFAULT_SCAN_RULES,
    detectFramework,
    discoverServiceDefinitions,
    findService,
    getApplicationName,
    getConfiguredLogPath,
    getDefaultLogPath,
    getLogFilePath,
    getServerPort,
    listServices,
    loadConfig,
    queryLogs,
    resolveLogPath,
    resolveProjectRoot,
    saveConfig,
    scanProject,
};
