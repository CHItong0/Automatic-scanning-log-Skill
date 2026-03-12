---
name: logs-auto
description: Automatically query and display logs for services mentioned in conversation. Analyzes context to find service names and fetches relevant logs using the logs-plugin scanner.
license: MIT
compatibility: Requires logs-plugin (scanner.js and config.json).
metadata:
  author: claude
  version: "1.0"
---

# Logs Auto Query Skill

Automatically analyze conversation context, identify service names, and query their logs.

## Trigger

When user asks to view logs or mentions a problem with a specific service.

## Workflow

### Step 1: Analyze Context

Read the current conversation to identify:
- Service names mentioned (e.g., "ai-server", "system-server", "gateway")
- Error keywords or symptoms (e.g., "ERROR", "failed", "exception")
- Time context (e.g., "recent", "today", specific timestamp)

### Step 2: Load Service Configuration

Execute scanner to get available services:
```bash
node .claude/logs-plugin/scanner.js list
```

Or use the config file directly at `.claude/logs-plugin/config.json`.

### Step 3: Match Service

Match identified service names to configured services:
- Exact match on `name` field
- Partial match on `module` field
- Fuzzy match if exact match fails

### Step 4: Query Logs

Query logs using scanner.js:
```bash
node .claude/logs-plugin/scanner.js query <service-name> [lines] [filter]
```

Default: 100 lines, no filter. Adjust based on context:
- If error reported: add ERROR filter
- If specific time: increase line count
- If debugging: show more context (200+ lines)

### Step 5: Display Results

Present logs in a clear format:
- Show service name and time range
- Display log content with syntax highlighting if possible
- Highlight any errors or warnings found

## Examples

**User says**: "Check the ai-server logs"
**Action**: Query ai-server with 100 lines, display results

**User says**: "What errors did we have in system-server today?"
**Action**: Query system-server with ERROR filter, show results

**User says**: "Show me recent logs for gateway"
**Action**: Query gateway-server with 50 lines, display results

## Notes

- If no service is identified, ask user which service to query
- If service not found, show available services from config
- Log path expansion: handles ~, ${user.home}, ${spring.application.name}
