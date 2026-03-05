---
name: JIRA dmtools Agent Skill
overview: Add a Cursor agent skill so the IDE agent can perform JIRA operations by running dmtools CLI commands, following Cursor/skills.sh conventions and the official dmtools JIRA tools reference. Four implementation directions are proposed for you to choose from.
todos: []
isProject: false
---

# JIRA dmtools Agent Skill – Options and Plan

## Context

- **Goal:** Enable Cursor’s agent to perform JIRA operations by running **dmtools CLI** commands (search, get ticket, create, update, comment, move status, assign, etc.).
- **Reference:** [dmtools JIRA MCP tools](https://github.com/IstiN/dmtools/blob/main/dmtools-ai-docs/references/mcp-tools/jira-tools.md) (52 tools); invocation in this repo is via **terminal** (`dmtools jira_`*), not MCP.
- **Existing assets:** [.dmtools/dmtools_commands_jira.md](.dmtools/dmtools_commands_jira.md) (concise table + examples), [agents/instructions/common/jira_context.md](agents/instructions/common/jira_context.md) (JQL for parent/child context), and [src/services/change-history-extractor.ts](src/services/change-history-extractor.ts) (examples of `--data` JSON and response handling).
- **Cursor best practice:** Use a **Skill** (`.cursor/skills/<name>/SKILL.md`) with frontmatter `name` and `description` and clear “when to use” + step-by-step instructions ([Cursor docs – Agent Skills](https://cursor.com/docs/context/skills)). Skills are discovered from `.cursor/skills/` (project) or `~/.cursor/skills/` (global). No JIRA-specific skill was found on [skills.sh](https://skills.sh/?q=jira); the standard pattern is one folder per skill with a single `SKILL.md`.

---

## Option A: Single Cursor Skill (recommended for a first draft)

**What:** One skill that teaches the agent when and how to use dmtools for JIRA.

**Where:** `.cursor/skills/jira-dmtools/SKILL.md`

**Contents (draft outline):**

- **Frontmatter:** `name: jira-dmtools`, `description:`
  - e.g. “Use when the user asks to search, read, create, update, or manage JIRA tickets. Run dmtools CLI commands in the terminal; JIRA config must be in dmtools.env or environment.”
- **When to use:** User mentions JIRA, tickets, issues, story, epic, backlog, assign, status, comment, fix version, etc.
- **Prerequisites:** `dmtools` on PATH; JIRA configured (e.g. `dmtools.env` or `JIRA_BASE_PATH`, `JIRA_EMAIL`, `JIRA_API_TOKEN`). Optional: suggest `dmtools jira_get_my_profile` to verify.
- **How to invoke:** Prefer terminal commands. Two patterns used in repo:
  - **Positional:** e.g. `dmtools jira_get_ticket PROJ-123` or `dmtools jira_search_by_jql "project = PROJ" "summary,status"`.
  - **JSON payload:** `dmtools jira_search_by_jql --data '{"jql": "project = PROJ AND status = Open", "fields": ["key","summary"]}'` (parameter names per [jira-tools.md](https://github.com/IstiN/dmtools/blob/main/dmtools-ai-docs/references/mcp-tools/jira-tools.md)).
- **Core operations (short list):**
  - Search: `jira_search_by_jql` (JQL + optional fields).
  - Get ticket: `jira_get_ticket` (key; optional fields).
  - Create: `jira_create_ticket_basic` or `jira_create_ticket_with_json` / `jira_create_ticket_with_parent`.
  - Update: `jira_update_ticket`, `jira_update_field`, `jira_update_description`.
  - Comment: `jira_post_comment`, `jira_get_comments`.
  - Workflow: `jira_get_transitions`, `jira_move_to_status`, `jira_move_to_status_with_resolution`.
  - Assign: `jira_get_account_by_email` then `jira_assign_ticket_to`.
  - Fix version: `jira_get_fix_versions`, `jira_set_fix_version` / `jira_add_fix_version`.
  - Link issues: `jira_get_issue_link_types`, `jira_link_issues`.
- **Full reference:** Point to project’s [.dmtools/dmtools_commands_jira.md](.dmtools/dmtools_commands_jira.md) and upstream [jira-tools.md](https://github.com/IstiN/dmtools/blob/main/dmtools-ai-docs/references/mcp-tools/jira-tools.md) for all 52 tools and exact parameters.
- **Output:** Commands return JSON; parse stdout for issues/keys/errors; on failure check stderr and dmtools exit code.

**Pros:** One artifact, standard Cursor/skills.sh format, auto-discovered.  
**Cons:** Single file can get long if many examples are inlined; agent uses terminal only (no structured tool calls).

---

## Option B: Cursor Rule + Skill

**What:** A Cursor Rule that gives brief “use dmtools for JIRA” context whenever relevant, plus a Skill with detailed instructions.

**Where:**

- Rule: [.cursor/rules/jira-dmtools.mdc](.cursor/rules/jira-dmtools.mdc) (or similar name).
- Skill: `.cursor/skills/jira-dmtools/SKILL.md` (same as Option A content, possibly slightly shorter “reference” section).

**Rule content (draft):**

- **globs:** e.g. `**/*.md`, `**/jira*.json`, `**/agents/`** so it applies in docs and agent config areas; or no globs and rely on description.
- **description:** “When the user or code involves JIRA tickets, use the dmtools CLI: run `dmtools jira_<tool>` in the terminal. See .cursor/skills/jira-dmtools for full instructions.”
- Short reminder: “JIRA operations: use dmtools CLI (dmtools.env or env vars must be set). List tools: `dmtools list | jq '.tools[] | select(.name | startswith(\"jira_\"))'`.”

**Pros:** Rule loads in relevant files for quick context; Skill adds depth when the agent actually does JIRA tasks.  
**Cons:** Two places to keep in sync; rule may add tokens even when JIRA is not the current task.

---

## Option C: Layered Skills (core + reference)

**What:** Split into a “core” skill (frequent operations) and an optional “reference” so the agent only pulls in the full tool list when needed.

**Where:**

- `.cursor/skills/jira-dmtools/SKILL.md` – “Core” skill: when to use, prerequisites, ~10–15 most-used operations with one example each (search, get, create, update, comment, transitions, assign, fix version, link). State that for the complete list of 52 tools and parameters, see the reference below or the linked docs.
- Either:
  - In the same file: a “Full reference” section with a compact table of all tool names + one-line purpose and link to [jira-tools.md](https://github.com/IstiN/dmtools/blob/main/dmtools-ai-docs/references/mcp-tools/jira-tools.md), or
  - Second skill: `.cursor/skills/jira-dmtools-reference/SKILL.md` that only contains the table + link (description: “Use when you need the exact parameters or name of a less common jira_* dmtools command.”).

**Pros:** Core skill stays small; full reference available without bloating the main instructions.  
**Cons:** Two skills to maintain if you use a separate reference skill; slightly more structure.

---

## Option D: Main skill + subfolder subskills (one per command or group)

**What:** A **main** SKILL.md that holds the **reference of all commands** (when to use JIRA/dmtools, prerequisites, how to invoke, and a single consolidated table of all 52 tools with CLI examples). **Subskills** live in a **subfolder** next to it, each covering one dmtools CLI command or a small group of related commands, with focused step-by-step instructions and examples.

**Where:**

- **Main skill:** [.cursor/skills/jira-dmtools/SKILL.md](.cursor/skills/jira-dmtools/SKILL.md)  
  - Content: frontmatter (`name: jira-dmtools`, description for "when to use JIRA / run dmtools"); when to use; prerequisites; how to invoke (positional vs `--data`); **full reference** (one table of all 52 tools with name, short description, parameters, CLI example). No long procedural sections—keep it as the index and reference. Optionally add: "For detailed steps and examples for a command group, see the subskills in `commands/`."
- **Subfolder:** `.cursor/skills/jira-dmtools/commands/`  
  - One **subskill per command or group** of close commands, each in its own folder with a `SKILL.md`:
    - `search/` – `jira_search_by_jql`, `jira_search_by_page`, `jira_search_with_pagination`
    - `tickets-read/` – `jira_get_ticket`, `jira_get_subtasks`, `jira_get_comments`, `jira_get_transitions`
    - `ticket-create/` – `jira_create_ticket_basic`, `jira_create_ticket_with_json`, `jira_create_ticket_with_parent`
    - `ticket-update/` – `jira_update_ticket`, `jira_update_field`, `jira_update_description`, `jira_update_all_fields_with_name`, `jira_update_ticket_parent`, `jira_clear_field`
    - `ticket-delete/` – `jira_delete_ticket`
    - `workflow/` – `jira_move_to_status`, `jira_move_to_status_with_resolution`, `jira_assign_ticket_to`
    - `profile/` – `jira_get_account_by_email`, `jira_get_my_profile`, `jira_get_user_profile`
    - `comments/` – `jira_post_comment`, `jira_post_comment_if_not_exists`, `jira_get_comments`
    - `fix-versions/` – `jira_get_fix_versions`, `jira_set_fix_version`, `jira_add_fix_version`, `jira_remove_fix_version`
    - `links-labels-priority/` – `jira_get_issue_link_types`, `jira_link_issues`, `jira_add_label`, `jira_set_priority`
    - `fieldsdata/` – `jira_get_fields`, `jira_get_field_custom_code`, `jira_get_all_fields_with_name`
    - `metadata/` – `jira_get_issue_types`, `jira_get_project_statuses`, `jira_get_components`
    - `attachments/` – `jira_attach_file_to_ticket`, `jira_download_attachment`
    - `xray/` – all `jira_xray`_* tools
    - `advanced/` – `jira_execute_request`

Each subskill SKILL.md has: its own frontmatter (`name: jira-dmtools-<group>`, description that triggers when the user needs that command or group); concise "when to use this" for that group; parameter summary; step-by-step instructions; CLI examples (positional and `--data` where relevant); notes (e.g. JSON escaping, response shape).

**Discovery:** Cursor discovers skills from `.cursor/skills/`. If it discovers only **top-level** folders (e.g. only `jira-dmtools` and not `jira-dmtools/commands/search`), then the main skill is the only auto-loaded skill and the `commands/` content is used as **referenced documentation** (main skill can say "see `commands/<group>/SKILL.md` for details" so the agent or user can open that file when needed). If Cursor **does** discover nested SKILL.md files (as in the [forum](https://forum.cursor.com/t/skill-from-subdirectories/149657)), then each `commands/<group>/SKILL.md` appears as a separate skill and can be invoked when the user intent matches that group.

**Pros:** Main skill stays a single reference; deep detail is in small, focused subskills; easy to add or change one command group without touching the rest.  
**Cons:** More files to maintain; discovery of nested skills is environment-dependent so document the fallback (main + optional manual/open of subskill files).

---

## Recommendation and next step

- **For a first draft:** **Option A** is the simplest and matches Cursor/skills.sh practice; you can later split (Option C), add a rule (Option B), or introduce the main + subfolder subskills layout (Option D).
- **Parameter naming:** The repo’s [change-history-extractor.ts](src/services/change-history-extractor.ts) uses `searchQueryJQL` for search; the official doc uses `jql`. The skill should follow the **official jira-tools.md** parameter names and mention that `dmtools` may accept both positional and `--data` JSON; when in doubt, use the form documented in [.dmtools/dmtools_commands_jira.md](.dmtools/dmtools_commands_jira.md) or run `dmtools jira_<name> --help` if available.

Choose one of **A**, **B**, **C**, or **D** (or a combination, e.g. A + a minimal rule from B). After you pick, the next step is to add the chosen file(s) and fill in the exact SKILL.md (and optionally rule) text.