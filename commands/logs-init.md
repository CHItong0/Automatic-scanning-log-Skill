# /logs-init

初始化日志插件，扫描项目服务并生成标准配置文件。

## 目的

- 检测项目框架
- 扫描服务模块和网关
- 提取服务名、端口、日志路径
- 生成 `config.json`

## 执行

```bash
node <plugin-root>/scanner.js init
```

## 输出

- 在插件根目录生成 `config.json`
- 输出扫描到的服务数量
- 后续 `/logs`、`/logs-auto`、`/logs-solve` 都依赖这个配置
