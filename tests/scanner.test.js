const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

function makeTempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

function createFixture(t) {
    const workspaceRoot = makeTempDir('logs-plugin-workspace-');
    const pluginRoot = path.join(workspaceRoot, 'plugin');
    const projectRoot = path.join(workspaceRoot, 'project');
    const homeDir = path.join(workspaceRoot, 'home');

    fs.mkdirSync(pluginRoot, { recursive: true });
    fs.copyFileSync(
        path.join(__dirname, '..', 'scanner.js'),
        path.join(pluginRoot, 'scanner.js')
    );
    fs.mkdirSync(path.join(pluginRoot, 'scripts'), { recursive: true });
    fs.copyFileSync(
        path.join(__dirname, '..', 'scripts', 'logs-scanner-core.js'),
        path.join(pluginRoot, 'scripts', 'logs-scanner-core.js')
    );
    fs.copyFileSync(
        path.join(__dirname, '..', 'scripts', 'logs-scanner-cli.js'),
        path.join(pluginRoot, 'scripts', 'logs-scanner-cli.js')
    );

    writeFile(
        path.join(projectRoot, 'pom.xml'),
        [
            '<project>',
            '  <modelVersion>4.0.0</modelVersion>',
            '  <groupId>example</groupId>',
            '  <artifactId>sample-platform</artifactId>',
            '</project>',
        ].join('\n')
    );

    writeFile(
        path.join(
            projectRoot,
            'services',
            'orders-api',
            'src',
            'main',
            'resources',
            'application.yml'
        ),
        [
            'spring:',
            '  application:',
            '    name: orders-api',
            'logging:',
            '  file:',
            '    name: ${user.home}/logs/${spring.application.name}.log',
            'server:',
            '  port: 48090',
        ].join('\n')
    );

    writeFile(
        path.join(
            projectRoot,
            'services',
            'orders-api',
            'src',
            'main',
            'resources',
            'logback.xml'
        ),
        '<configuration><appender><file>${LOG_FILE}</file></appender></configuration>'
    );

    writeFile(
        path.join(
            projectRoot,
            'platform',
            'edge-proxy',
            'src',
            'main',
            'resources',
            'application.yaml'
        ),
        [
            'spring:',
            '  application:',
            '    name: edge-proxy',
            'server:',
            '  port: 8080',
        ].join('\n')
    );

    writeFile(
        path.join(
            projectRoot,
            'platform',
            'edge-proxy',
            'src',
            'main',
            'resources',
            'logback-spring.xml'
        ),
        '<configuration><appender><file>C:/logs/edge-proxy.log</file></appender></configuration>'
    );

    writeFile(
        path.join(
            projectRoot,
            'workers',
            'fulfillment-worker',
            'src',
            'main',
            'resources',
            'bootstrap.yaml'
        ),
        [
            'spring:',
            '  application:',
            '    name: fulfillment-worker',
            'logging:',
            '  file:',
            '    path: ${user.home}/worker-logs',
            'server:',
            '  port: 9090',
        ].join('\n')
    );

    t.after(() => {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    });

    const env = {
        ...process.env,
        PROJECT_ROOT: projectRoot,
        HOME: homeDir,
        USERPROFILE: homeDir,
    };

    return { pluginRoot, projectRoot, homeDir, env };
}

function runScanner(pluginRoot, env, ...args) {
    return execFileSync(process.execPath, ['scanner.js', ...args], {
        cwd: pluginRoot,
        env,
        encoding: 'utf8',
    });
}

test('init generates config from arbitrary discovered service roots', (t) => {
    const { pluginRoot, env, projectRoot, homeDir } = createFixture(t);

    const output = runScanner(pluginRoot, env, 'init');
    const configPath = path.join(pluginRoot, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    assert.match(output, /Scanning project/);
    assert.equal(config.framework, 'spring-boot');
    assert.equal(config.projectPath, projectRoot);
    assert.deepEqual(config.services, [
        {
            module: 'edge-proxy',
            name: 'edge-proxy',
            logPath: 'C:/logs/edge-proxy.log',
            port: 8080,
        },
        {
            module: 'fulfillment-worker',
            name: 'fulfillment-worker',
            logPath: '${user.home}/worker-logs/fulfillment-worker.log',
            port: 9090,
        },
        {
            module: 'orders-api',
            name: 'orders-api',
            logPath: '${user.home}/logs/${spring.application.name}.log',
            port: 48090,
        },
    ]);

    assert.equal(
        config.services[2].logPath
            .replace('${user.home}', homeDir)
            .replace('${spring.application.name}', 'orders-api')
            .replace(/\\/g, '/'),
        path.join(homeDir, 'logs', 'orders-api.log').replace(/\\/g, '/')
    );

    assert.equal(
        config.services[1].logPath
            .replace('${user.home}', homeDir)
            .replace(/\\/g, '/'),
        path.join(homeDir, 'worker-logs', 'fulfillment-worker.log').replace(/\\/g, '/')
    );
});

test('list prints service summary from generated config', (t) => {
    const { pluginRoot, env } = createFixture(t);

    runScanner(pluginRoot, env, 'init');
    const output = runScanner(pluginRoot, env, 'list');

    assert.match(output, /Framework: spring-boot/);
    assert.match(output, /Total services: 3/);
    assert.match(output, /fulfillment-worker \(fulfillment-worker\) - port: 9090/);
    assert.match(output, /orders-api \(orders-api\) - port: 48090/);
    assert.match(output, /edge-proxy \(edge-proxy\) - port: 8080/);
});

test('query resolves home placeholders and filters the last lines', (t) => {
    const { pluginRoot, env, homeDir } = createFixture(t);

    runScanner(pluginRoot, env, 'init');

    writeFile(
        path.join(homeDir, 'logs', 'orders-api.log'),
        [
            'INFO boot ok',
            'warn cache miss',
            'ERROR database timeout',
            'info request finished',
            'error retry failed',
        ].join('\n')
    );

    const output = runScanner(pluginRoot, env, 'query', 'orders-api', '4', 'error');

    assert.match(output, /Logs from orders-api \(last 4 lines, filtered: error\)/);
    assert.doesNotMatch(output, /INFO boot ok/);
    assert.match(output, /ERROR database timeout/);
    assert.match(output, /error retry failed/);
    assert.doesNotMatch(output, /warn cache miss/);
});

test('query exits with usage error when service name is missing', (t) => {
    const { pluginRoot, env } = createFixture(t);
    runScanner(pluginRoot, env, 'init');

    const result = spawnSync(process.execPath, ['scanner.js', 'query'], {
        cwd: pluginRoot,
        env,
        encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Usage: node scanner\.js query <service>/);
});
