---
name: logs
description: 列出已扫描的服务，或按服务名查询最近日志并按关键字过滤。用户要求查看服务列表、查看某个服务日志、或筛选错误日志时使用。
---

# logs

统一日志查询入口。

## 执行规则

1. 先检查插件根目录是否存在 `config.json`。
2. 如果配置不存在，先运行 `node <plugin-root>/scanner.js init`。
3. 如果用户没有传参，运行 `node <plugin-root>/scanner.js list` 并展示服务清单。
4. 如果用户传了服务名，运行 `node <plugin-root>/scanner.js query <service> [lines] [filter]`。
5. 默认读取最近 `50` 行；只有用户明确指定时才扩大范围。

## 参数约定

- `/logs`
  显示已扫描服务列表。
- `/logs <service>`
  显示指定服务最近 `50` 行日志。
- `/logs <service> <lines>`
  显示指定服务最近 `lines` 行日志。
- `/logs <service> <lines> <filter>`
  仅显示最近 `lines` 行里包含 `filter` 的日志。

## 示例

```text
/logs
/logs orders-api
/logs orders-api 100
/logs edge-proxy 200 error
```

## 失败处理

- 如果服务不存在，展示可用服务名。
- 如果日志文件不存在，明确展示解析后的日志路径。
- 不要猜测服务名；匹配失败时返回候选列表。
