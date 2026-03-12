---
name: logs-solve
description: Query logs for a service, analyze errors, and automatically fix them using systematic debugging. Chains /logs-auto with superpowers:systematic-debugging.
license: MIT
compatibility: Requires logs-plugin and superpowers:systematic-debugging skill.
metadata:
  author: claude
  version: "1.0"
---

# Logs Solve Skill

Automatically query logs, analyze errors, and invoke systematic debugging to fix issues.

## Trigger

When user asks to debug/fix a service problem and wants automatic log analysis + fixing.

## Workflow

### Step 1: Analyze Context

Read the current conversation to identify:
- Service names mentioned
- Error symptoms described
- What the user wants to accomplish

### Step 2: Invoke /logs-auto

First, call the logs-auto skill to fetch logs:
- Use Skill tool: `skill: "logs-auto"` with args containing the service name
- Let logs-auto display the log content

### Step 3: Analyze Log Errors

After logs are displayed, analyze the content for:
- Java exceptions (NullPointerException, RuntimeException, etc.)
- Error messages (ERROR, Exception, Failed)
- Stack traces
- Root cause indicators

### Step 4: Invoke systematic-debugging

After analysis, invoke the systematic-debugging skill:
- Use Skill tool: `skill: "superpowers:systematic-debugging"`
- Pass the context including:
  - Service name
  - Error details from logs
  - What the user wants to achieve

The systematic-debugging skill will:
- Investigate the root cause
- Propose and implement fixes
- Verify the solution

## Examples

**User says**: "Fix the ai-server errors"
**Action**:
1. Call logs-auto for ai-server
2. Analyze errors in logs
3. Call systematic-debugging with error context

**User says**: "Debug why system-server is failing"
**Action**:
1. Call logs-auto for system-server
2. Analyze logs for failure patterns
3. Call systematic-debugging to investigate and fix

## Notes

- Always invoke logs-auto FIRST to get fresh log data
- Provide detailed error context to systematic-debugging
- The skill chains two capabilities: log analysis + automated debugging
- If no clear errors found, still invoke systematic-debugging with the service context
