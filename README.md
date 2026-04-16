[English](README-en.md) | [中文](README.md)

# 自动扫描日志插件

一个按标准 Codex 插件/技能协议整理过的通用日志扫描插件。它负责递归发现服务配置、生成统一日志配置，并通过技能入口提供服务列表、日志查询和日志驱动的问题排查。

## 标准结构

```
automatic-scanning-log-skill/
├── .codex-plugin/plugin.json    # 插件 manifest
├── commands/                    # 命令协议
├── skills/                      # 技能协议
├── scripts/                     # 可复用核心实现
├── scanner.js                   # 兼容 CLI 入口
├── tests/                       # 回归测试
└── settings.json.hook           # Hook 配置
```

## 模块说明

| 模块 | 文件 | 功能 |
|------|------|------|
| **Manifest** | `.codex-plugin/plugin.json` | 描述插件元数据、技能目录和 Hook 入口 |
| **Commands** | `commands/` | `/logs-init` 的标准命令说明 |
| **Skills** | `skills/` | `/logs`、`/logs-auto`、`/logs-solve` 的标准技能协议 |
| **Core Scripts** | `scripts/` | 扫描、配置读写、日志查询、CLI 分发 |
| **CLI Wrapper** | `scanner.js` | 保留原入口，兼容既有调用方式 |
| **Config** | `config.json` | 扫描后生成的服务和日志配置 |
| **Tests** | `tests/` | 锁定 `init/list/query` 行为的回归测试 |

## 功能特性

- **自动扫描服务**：递归发现服务配置和日志配置
- **多种查询方式**：支持指定服务、行数、关键词过滤
- **自动修复**：结合 systematic-debugging 自动分析并修复问题
- **智能 Hook**：监听用户消息，自动触发日志查询

## 支持框架

- Spring Boot
- Node.js
- Python
- Go
- 未识别框架时回退为 `unknown`

## 快速开始

### 1. 安装到插件目录

```bash
# 将整个目录放到你的插件位置
# 然后按 manifest 或技能目录进行挂载
```

### 2. 初始化扫描

首次使用需要扫描项目服务：

```
/logs-init
```

这会：
- 检测项目框架
- 递归扫描候选服务目录
- 查找日志配置文件
- 生成插件根目录下的 `config.json`

### 3. 查询日志

```
# 查看服务列表
/logs

# 查看指定服务日志
/logs orders-api
/logs orders-api 50
/logs edge-proxy 200 error
```

## 命令与技能

### /logs-init

初始化插件，扫描项目服务。

```
/logs-init
```

### /logs

统一日志查询入口。

```
/logs                        # 显示所有服务列表
/logs orders-api             # 查看 orders-api 最近 50 行
/logs orders-api 50          # 查看最近 50 行
/logs orders-api 100 error   # 过滤包含 error 的日志
```

### /logs-auto

根据上下文自动识别服务名并查询。

```
/logs-auto
```

### /logs-solve

查询日志后提取错误线索，并把摘要交给修复流程。

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

## 扫描配置格式

首次运行 `/logs-init` 后会生成：

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

当前默认识别这些常见文件和目录约定：

- `application.yaml` / `application.yml`
- `bootstrap.yaml` / `bootstrap.yml`
- `logback-spring.xml` / `logback.xml`
- `src/main/resources`

## 开发验证

```bash
npm run check
```

这会执行：

- `node --check` 语法检查
- `node --test` 回归测试

## 常见问题

### Q: 日志文件不存在？

A: 确保服务已经运行过，日志文件才会生成；同时检查 `config.json` 中展开后的 `logPath`。

### Q: 如何查看其他服务的日志？

A: 先运行 `/logs` 查看所有可用服务，然后使用 `/logs <服务名>` 查询。

### Q: 可以自定义日志路径吗？

A: 可以调整 `scripts/logs-scanner-core.js` 中的提取逻辑，或手动编辑 `config.json`。

## 开源协议

MIT License
