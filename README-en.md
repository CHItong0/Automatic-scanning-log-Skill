[English](README-en.md) | [中文](README.md)

# Claude Code Logs Plugin (logs-plugin)

A Claude Code plugin for managing and querying microservice logs.

## Architecture

```
                    ┌─────────────┐
                    │    User    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  User Input │
                    │ /logs ai 50 │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │         Hooks          │ ← Listens to user messages, auto-triggers
              │  settings.json.hook   │
              └────────────┬────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
    ┌─────────────┐                ┌─────────────┐
    │  Commands   │                │   Skills    │
    │ /logs-init  │                │ /logs       │
    │             │                │ /logs-auto  │
    │  Initialize │                │ /logs-solve │
    └──────┬──────┘                └──────┬──────┘
           │                               │
           │         ┌─────────────┐       │
           └────────►│  Scanner    │◄──────┘
                    │ scanner.js   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Config    │
                    │ config.json│
                    └─────────────┘
```

### Module Description

| Module | File | Function |
|--------|------|----------|
| **Hooks** | `settings.json.hook` | Monitors user messages, matches keywords to auto-trigger prompts |
| **Commands** | `commands/` | `/logs-init` - Initialize and scan project services |
| **Skills** | `skills/` | `/logs` query, `/logs-auto` auto query, `/logs-solve` query and fix |
| **Scanner** | `scanner.js` | Scans project directory, identifies framework type, extracts service info |
| **Config** | `config.json` | Stores framework type, service list, log paths, etc. |

## Features

- **Auto-scan services**: Automatically detects all microservices in the project
- **Multiple query methods**: Support specifying service, line count, keyword filtering
- **Auto-fix**: Combines systematic-debugging to automatically analyze and fix issues
- **Smart Hook**: Monitors user messages and automatically triggers log queries

## Supported Frameworks

- Spring Boot
- Spring Cloud
- Node.js
- Python
- Go
- .NET
- ... (More frameworks extensible)

## Quick Start

### 1. Installation

```bash
# Copy plugin files to project .claude directory
cp -r logs-plugin/* .claude/
```

### 2. Initialize

First-time use requires scanning project services:

```
/logs-init
```

This will:
- Detect project framework
- Scan all service modules
- Find log configuration files
- Generate `.claude/logs-plugin/config.json`

### 3. Query Logs

```
# View service list
/logs

# View specific service logs
/logs ai
/logs ai 50
/logs error
```

## Command Reference

### /logs-init

Initialize the plugin and scan project services.

```
/logs-init
```

### /logs

Unified log query command.

```
/logs              # Show all service list
/logs ai          # View ai service last 100 lines
/logs ai 50       # View last 50 lines
/logs ai 100 error # Filter logs containing error
```

### /logs-auto

Auto query logs. Automatically identifies service name and queries based on conversation context.

```
/logs-auto
```

### /logs-solve

Query logs and auto-fix. After querying logs, analyzes errors and calls systematic-debugging to fix.

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

### Trigger Conditions

| User Input | Trigger Command |
|------------|-----------------|
| 查下日志 | /logs |
| 查日志 | /logs |
| 查日志并解决bug | /logs-solve |

## Configuration

### Config File

After first run of `/logs-init`, `.claude/logs-plugin/config.json` will be generated:

```json
{
  "framework": "spring-boot",
  "projectPath": "E:\\project\\path",
  "services": [
    {
      "module": "aidouxue-module-ai-biz",
      "name": "ai-server",
      "logPath": "${user.home}/logs/${spring.application.name}.log",
      "port": 48090
    }
  ]
}
```

### Framework Detection

Plugin automatically detects project framework:

| Framework | Detection File | Log Config |
|-----------|----------------|------------|
| Spring Boot | pom.xml | application.yaml, logback.xml |
| Spring Cloud | pom.xml + bootstrap.yaml | application.yaml |
| Node.js | package.json | Default path |
| Python | requirements.txt | logging.conf |
| Go | go.mod | Default path |

## File Structure

```
logs-plugin/
├── README.md                    # Documentation
├── README-en.md                 # English documentation
├── scanner.js                   # Scanner script
├── settings.json.hook          # Hooks configuration
├── commands/
│   └── logs-init.md            # /logs-init command
└── skills/
    ├── logs/                   # /logs unified log query
    ├── logs-auto/              # /logs-auto auto query logs
    └── logs-solve/             # /logs-solve query and fix
```

## FAQ

### Q: Log file doesn't exist?

A: Make sure the service has been run at least once for log files to be generated. Check if `logPath` in configuration is correct.

### Q: How to view other service logs?

A: Run `/logs` first to see all available services, then use `/logs <service-name>` to query.

### Q: Can I customize log path?

A: Yes, modify the log detection logic in `scanner.js`, or manually edit `config.json`.

## License

MIT License
