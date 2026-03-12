# Claude Code 日志插件 (logs-plugin)

一款用于管理和查询微服务日志的 Claude Code 插件。

## 架构说明

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input                                │
│  "查下日志" / "查日志并解决bug" / /logs ai 50 error             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Hooks                                    │
│  UserPromptSubmit Hook (settings.json.hook)                     │
│  - 监听用户消息                                                  │
│  - 匹配关键词 (查日志、查日志并解决bug)                           │
│  - 自动触发命令提示                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│      Commands           │    │        Skills                │
│  /logs-init             │    │  /logs       /logs-auto     │
│  - 扫描项目服务         │    │  /logs-solve                 │
│  - 检测框架类型         │    │  - 读取配置                  │
│  - 生成 config.json     │    │  - 查询日志                  │
└─────────────────────────┘    │  - 过滤分析                  │
                               │  - 自动修复                  │
                               └─────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Scanner                                   │
│  scanner.js                                                      │
│  - 扫描项目目录                                                  │
│  - 识别框架类型 (Spring Boot/Cloud, Node.js, Python, Go, .NET)  │
│  - 查找日志配置文件                                              │
│  - 提取服务信息 (模块名、端口、日志路径)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Configuration                                  │
│  .claude/logs-plugin/config.json                                 │
│  {                                                               │
│    "framework": "spring-boot",                                   │
│    "services": [                                                 │
│      { "module": "ai-server", "name": "ai", "port": 48090 }     │
│    ]                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## 功能特性

- **自动扫描服务**：自动检测项目中的所有微服务
- **多种查询方式**：支持指定服务、行数、关键词过滤
- **自动修复**：结合 systematic-debugging 自动分析并修复问题
- **智能 Hook**：监听用户消息，自动触发日志查询

## 支持的框架

- Spring Boot
- Spring Cloud
- Node.js
- Python
- Go
- .NET

## 快速开始

### 1. 安装

```bash
# 复制插件文件到项目 .claude 目录
cp -r logs-plugin/* .claude/
```

### 2. 初始化

首次使用需要扫描项目服务：

```
/logs-init
```

这会：
- 检测项目框架
- 扫描所有服务模块
- 查找日志配置文件
- 生成 `.claude/logs-plugin/config.json`

### 3. 查询日志

```
# 查看服务列表
/logs

# 查看指定服务日志
/logs ai
/logs ai 50
/log error
```

##s ai 100 命令详解

### /logs-init

初始化插件，扫描项目服务。

```
/logs-init
```

### /logs

统一日志查询命令。

```
/logs              # 显示所有服务列表
/logs ai          # 查看 ai 服务最近 100 行
/logs ai 50       # 查看最近 50 行
/logs ai 100 error # 过滤包含 error 的日志
```

### /logs-auto

自动查日志。根据对话上下文自动识别服务名并查询。

```
/logs-auto
```

### /logs-solve

查日志并自动修复。查询日志后，分析错误并调用 systematic-debugging 修复。

```
/logs-solve
```

## Hook 配置

插件包含自动触发 Hook，可在用户提到相关关键词时自动提示。

### 配置方法

将 `settings.json.hook` 内容添加到 `.claude/settings.json`：

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

### 触发条件

| 用户输入 | 触发命令 |
|----------|----------|
| 查下日志 | /logs |
| 查日志 | /logs |
| 查日志并解决bug | /logs-solve |

## 配置说明

### 配置文件

首次运行 `/logs-init` 后，会生成 `.claude/logs-plugin/config.json`：

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

### 框架检测

插件自动检测项目框架：

| 框架 | 检测文件 | 日志配置 |
|------|----------|----------|
| Spring Boot | pom.xml | application.yaml, logback.xml |
| Spring Cloud | pom.xml + bootstrap.yaml | application.yaml |
| Node.js | package.json | 默认路径 |
| Python | requirements.txt | logging.conf |
| Go | go.mod | 默认路径 |

## 文件结构

```
logs-plugin/
├── README.md                    # 使用说明
├── scanner.js                   # 扫描脚本
├── settings.json.hook          # Hooks 配置
├── commands/
│   └── logs-init.md            # /logs-init 命令
└── skills/
    ├── logs/                   # /logs 统一日志查询
    ├── logs-auto/              # /logs-auto 自动查日志
    └── logs-solve/             # /logs-solve 查日志并修复
```

## 常见问题

### Q: 日志文件不存在？

A: 确保服务已经运行过，日志文件才会生成。检查配置中的 `logPath` 是否正确。

### Q: 如何查看其他服务的日志？

A: 先运行 `/logs` 查看所有可用服务，然后使用 `/logs <服务名>` 查询。

### Q: 可以自定义日志路径吗？

A: 可以修改 `scanner.js` 中的日志检测逻辑，或手动编辑 `config.json`。

## 开源协议

MIT License
