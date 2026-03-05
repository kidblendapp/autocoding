---
name: jira-dmtools-workflow
description: Use when the user needs to move a JIRA ticket to a status or assign it. Covers jira_move_to_status, jira_move_to_status_with_resolution, jira_assign_ticket_to. For user/profile (account by email, my profile, user profile) see profile subskill. Run dmtools in the terminal.
---

# JIRA workflow and assignment

## When to use this skill

Use when the user wants to:
- Move a ticket to another status (workflow transition)
- Move to Done (or similar) and set a resolution
- Assign a ticket to a user (by account ID; resolve email to accountId via profile subskill)

## Commands

| Tool | Purpose | Parameters |
|------|---------|------------|
| `jira_move_to_status` | Move to status (transition) | `key`, `statusName` (required) |
| `jira_move_to_status_with_resolution` | Move and set resolution | `key`, `statusName`, `resolution` (required) |
| `jira_assign_ticket_to` | Assign ticket to user | `key`, `accountId` (required) |

## Steps

1. **Transitions:** Get valid status names with `dmtools jira_get_transitions PROJ-123`, then call `jira_move_to_status` or `jira_move_to_status_with_resolution` with that `statusName` (and `resolution` for Done-like statuses).
2. **Assign:** If you have email, use the profile subskill to run `jira_get_account_by_email` to get `accountId`, then `jira_assign_ticket_to` with `key` and `accountId`.
3. All mutation commands use `--data` with JSON; run in terminal and parse stdout/stderr.

## Examples

```bash
# List transitions then move
dmtools jira_get_transitions PROJ-123
dmtools jira_move_to_status --data '{"key":"PROJ-123","statusName":"In Review"}'

# Move to Done with resolution
dmtools jira_move_to_status_with_resolution --data '{"key":"PROJ-123","statusName":"Done","resolution":"Fixed"}'

# Assign (accountId from jira_get_account_by_email in profile subskill)
dmtools jira_assign_ticket_to --data '{"key":"PROJ-123","accountId":"123456:uuid-from-above"}'
```

## Notes

- Status and resolution names must match your project's workflow (e.g. "In Progress", "Done", "Fixed"). Use `jira_get_transitions` to see allowed values.
- Assignee must have permission to be assigned; unassign by assigning to `null` if your JIRA allows it (check API).

## Avoiding malformed API URLs

These commands use `--data` with JSON. Ensure the JSON is valid and passed as a **single argument** (correct shell quoting); bad quoting can cause the CLI to split or mangle the request and produce 404s or malformed URLs. Use single quotes around the JSON and escape inner quotes if needed.
