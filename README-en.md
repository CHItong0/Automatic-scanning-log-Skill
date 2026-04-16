[English](README-en.md) | [中文](README.md)

# Automatic Log Scanner Plugin

This repository now follows a standard Codex plugin/skill layout for a generic log-scanning plugin. It recursively discovers service configs, persists log metadata, and exposes skills for listing services, querying logs, and chaining log-driven debugging workflows.

## Standard Layout

```
automatic-scanning-log-skill/
├── .codex-plugin/plugin.json
├── commands/
├── skills/
├── scripts/
├── scanner.js
├── tests/
└── settings.json.hook
```

## Modules

| Module | File | Function |
|--------|------|----------|
| **Manifest** | `.codex-plugin/plugin.json` | Declares plugin metadata, skills, and hook entrypoints |
| **Commands** | `commands/` | Standard command spec for `/logs-init` |
| **Skills** | `skills/` | Standard skill specs for `/logs`, `/logs-auto`, and `/logs-solve` |
| **Core Scripts** | `scripts/` | Reusable scanning, config, log-query, and CLI logic |
| **CLI Wrapper** | `scanner.js` | Backward-compatible CLI entrypoint |
| **Config** | `config.json` | Generated service and log metadata |
| **Tests** | `tests/` | Regression coverage for `init`, `list`, and `query` |

## Features

- **Auto-scan services**: Recursively discovers service and log configuration files
- **Multiple query methods**: Support specifying service, line count, keyword filtering
- **Auto-fix**: Combines systematic-debugging to automatically analyze and fix issues
- **Smart Hook**: Monitors user messages and automatically triggers log queries

## Supported Frameworks

- Spring Boot
- Node.js
- Python
- Go
- Falls back to `unknown` when nothing matches

## Quick Start

### 1. Install

```bash
# Place this directory where your Codex plugin loader can discover it
```

### 2. Initialize

First-time use requires scanning project services:

```
/logs-init
```

This will:
- Detect project framework
- Recursively scan candidate service directories
- Find log configuration files
- Generate `config.json` in the plugin root

### 3. Query Logs

```
# View service list
/logs

# View specific service logs
/logs orders-api
/logs orders-api 50
/logs edge-proxy 200 error
```

## Command Reference

### /logs-init

Initialize the plugin and scan project services.

```
/logs-init
```

### /logs

Unified log query entrypoint.

```
/logs                         # Show all services
/logs orders-api              # View last 50 lines
/logs orders-api 50           # View last 50 lines
/logs orders-api 100 error    # Filter logs containing error
```

### /logs-auto

Infer the service from context and query logs automatically.

```
/logs-auto
```

### /logs-solve

Query logs, summarize failure signals, and hand off debugging context to a repair workflow.

```
/logs-solve
```

## Hook Configuration

The plugin includes an auto-trigger Hook that automatically prompts when user mentions relevant keywords.

### Configuration Method

Add content from `settings.json.hook` to `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "查下日志|查日志(?!并解决)",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"请运行 /logs 命令查看日志\""
          }
        ]
      },
      {
        "matcher": "查日志并解决bug",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"请运行 /logs-solve 命令查日志并解决bug\""
          }
        ]
      }
    ]
  }
}
```

## Generated Config

After `/logs-init`, the plugin writes:

```json
{
  "framework": "spring-boot",
  "projectPath": "E:\\project\\path",
  "services": [
    {
      "module": "orders-api",
      "name": "orders-api",
      "logPath": "${user.home}/logs/${spring.application.name}.log",
      "port": 48090
    }
  ]
}
```

The default scanner currently recognizes these common files and directory conventions:

- `application.yaml` / `application.yml`
- `bootstrap.yaml` / `bootstrap.yml`
- `logback-spring.xml` / `logback.xml`
- `src/main/resources`

## Developer Verification

```bash
npm run check
```

This runs:

- `node --check` syntax validation
- `node --test` regression tests

## FAQ

### Q: Log file doesn't exist?

A: Make sure the service has produced logs at least once, and verify the resolved `logPath` from `config.json`.

### Q: How to view other service logs?

A: Run `/logs` first to see all available services, then use `/logs <service-name>` to query.

### Q: Can I customize log path?

A: Yes. Update the extraction rules in `scripts/logs-scanner-core.js`, or edit `config.json` manually.

## License

MIT License
