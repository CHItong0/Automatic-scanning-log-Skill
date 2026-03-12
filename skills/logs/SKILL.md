---
name: logs
description: 统一日志查询命令。带参数时查询指定服务日志，不带参数时显示服务列表供选择。
license: MIT
metadata:
  author: claude
  version: "1.0"
---

# logs - 统一日志查询

## 功能

### 带参数：/logs &lt;service&gt; [lines] [filter]

直接查询指定服务的日志。

**示例：**
```
/logs ai              # 查看 ai 服务最近 100 行日志
/logs ai 50          # 查看 ai 服务最近 50 行
/logs ai 100 error   # 查看 ai 服务包含 error 的日志
```

### 不带参数：/logs

显示服务列表供用户手动输入选择。

**流程：**
1. 检查是否已初始化（config.json 是否存在）
2. 如果未初始化，自动运行 init 扫描
3. 动态执行 `node .claude/logs-plugin/scanner.js list` 获取服务列表
4. 显示所有扫描到的服务列表
5. 提示用户直接输入服务名

## 实现

1. 读取 `.claude/logs-plugin/config.json`
2. 如果文件不存在，运行 `node .claude/logs-plugin/scanner.js init`
3. 解析配置，获取服务列表
4. 如果有参数，直接查询
5. 如果无参数，执行 `node .claude/logs-plugin/scanner.js list` 显示服务列表
