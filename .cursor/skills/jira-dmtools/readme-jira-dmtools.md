# jira-dmtools skill

**Location:** `.cursor/skills/jira-dmtools/`  
**Purpose:** Perform JIRA operations via the **dmtools** CLI. The skill describes when to use each command, the agent flow (verify → config → run), and how to invoke tools (positional vs `--data` JSON). Subskills under `commands/` hold the exact command and parameters per group.

---

## Skill description (summary)

Use when the user or task involves: searching or listing JIRA tickets; reading ticket details, comments, subtasks, or transitions; creating or updating tickets; adding/reading comments; moving tickets through workflow or assigning; linking issues; managing fix versions, labels, or attachments; or Xray test/precondition operations.

**Config:** JIRA is driven by **dmtools.env** (or env vars): `JIRA_BASE_PATH`, `JIRA_EMAIL`, `JIRA_API_TOKEN`. Optional: `JIRA_AUTH_TYPE` (default `basic`).

---

## Usage flow (agent)

Follow in order:

1. **Verify JIRA connection**  
   From repo root: `python .cursor/skills/jira-dmtools/scripts/verify_jira_connection.py --verify`  
   Checks that `.dmtools/jira.cfg` exists and is valid.

2. **Create or refresh config if missing/invalid**  
   If step 1 fails, run: `python .cursor/skills/jira-dmtools/scripts/verify_jira_connection.py`  
   Uses dmtools.env, calls JIRA, writes `.dmtools/jira.cfg`. Optionally `--project PROJ` to cache metadata.

3. **Select and run the command**  
   Match the task to the **"When to use"** column in the Command index below. Open `commands/<folder>/SKILL.md` for that group, then run the corresponding `dmtools` command (positional args or `--data '<JSON>'`).

**On 401/403/timeout:** Re-run step 2, then retry the command.

---

## How to invoke

- Run `dmtools <tool_name>` in the terminal. Use **positional** args for simple calls or **`--data '<JSON>'`** for complex or multi-parameter calls.
- Output is JSON on stdout; parse for `issues`, `key`, or error fields. Some responses wrap payload in `result`—handle both.
- List JIRA tools: `dmtools list | jq '.tools[] | select(.name | startswith("jira_"))'`

---

## Full command list (by group)

| Group | When to use | Tools |
|-------|-------------|-------|
| **Search** | Search or list tickets by JQL, project, status, or with paging. | `jira_search_by_jql`, `jira_search_by_page`, `jira_search_with_pagination` |
| **Read** | Get one ticket, its subtasks, comments, or available transitions. | `jira_get_ticket`, `jira_get_subtasks`, `jira_get_comments`, `jira_get_transitions` |
| **Create** | Create a ticket (basic, with custom fields, or as subtask under parent). | `jira_create_ticket_basic`, `jira_create_ticket_with_json`, `jira_create_ticket_with_parent` |
| **Update** | Change fields, description, parent, or clear a field on a ticket. | `jira_update_ticket`, `jira_update_field`, `jira_update_description`, `jira_update_all_fields_with_name`, `jira_update_ticket_parent`, `jira_clear_field` |
| **Delete** | Delete a ticket (irreversible). | `jira_delete_ticket` |
| **Workflow** | Move ticket to a status, set resolution, or assign to a user. | `jira_move_to_status`, `jira_move_to_status_with_resolution`, `jira_assign_ticket_to` |
| **Profile** | Resolve account ID by email, get current user or another user's profile. | `jira_get_account_by_email`, `jira_get_my_profile`, `jira_get_user_profile` |
| **Comments** | Add a comment or add only if not already present. | `jira_post_comment`, `jira_post_comment_if_not_exists` |
| **Fix versions** | List, set, add, or remove fix version(s) on a ticket or project. | `jira_get_fix_versions`, `jira_set_fix_version`, `jira_add_fix_version`, `jira_remove_fix_version` |
| **Links & labels** | List link types, link two issues, add label, or set priority. | `jira_get_issue_link_types`, `jira_link_issues`, `jira_add_label`, `jira_set_priority` |
| **Fields data** | Get field definitions or custom field ID(s) by display name for a project. | `jira_get_fields`, `jira_get_field_custom_code`, `jira_get_all_fields_with_name` |
| **Metadata** | Get issue types, statuses, or components for a project. | `jira_get_issue_types`, `jira_get_project_statuses`, `jira_get_components` |
| **Attachments** | Attach a file to a ticket or download an attachment by URL. | `jira_attach_file_to_ticket`, `jira_download_attachment` |
| **Xray** | Xray test/precondition operations. | `jira_xray_search_tickets`, `jira_xray_get_test_details`, `jira_xray_get_test_steps`, `jira_xray_get_preconditions`, `jira_xray_get_precondition_details`, `jira_xray_create_precondition`, `jira_xray_add_precondition_to_test`, `jira_xray_add_preconditions_to_test`, `jira_xray_add_test_step`, `jira_xray_add_test_steps` |
| **Advanced** | Run a custom GET request to the JIRA API with auth. | `jira_execute_request` |

**Subskills:** For each group, read `commands/<folder>/SKILL.md` (e.g. `commands/search/SKILL.md`) for the exact command and parameters.

---

## Important notes

- Prefer **positional** args where possible; use `--data` only when needed and ensure JSON is valid.
- Status and resolution names must match the project workflow; use `jira_get_transitions` for allowed values.
- For assignment: resolve email to accountId with `jira_get_account_by_email`, then pass `accountId` to `jira_assign_ticket_to`.
- **jira_delete_ticket** is irreversible; confirm before running.
- **References:** [dmtools jira-tools.md](https://github.com/IstiN/dmtools/blob/main/dmtools-ai-docs/references/mcp-tools/jira-tools.md); project: `.dmtools/dmtools_commands_jira.md`.

---

## Verification

Command verification is run from repo root via `tmp/jira-dmtools-verify/run-verify.ps1`. Set `JIRA_VERIFY_PROJECT`; optionally `JIRA_VERIFY_TICKET` and `JIRA_VERIFY_EMAIL`. See `tmp/jira-dmtools-verify/README.md` for flow and max-coverage instructions. Results are written to `tmp/jira-dmtools-verify/results.md`.
