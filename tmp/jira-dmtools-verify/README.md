# JIRA dmtools command verification

Run the verification script from the **repository root** (where `dmtools.env` is). It runs each jira-dmtools command group (read-only first, then mutations on a test ticket) and writes **results.md** with per-command status (ok / fail / skipped).

## Verification flow

1. **Pre-check:** `dmtools --version`, `jira_get_my_profile` (validates auth from `dmtools.env`).
2. **Read-only commands:** profile (account by email, user profile), metadata, fields, search, ticket read/subtasks/comments/transitions, link types, fix versions, `jira_execute_request`.
3. **Mutating commands:** create ticket (or use existing if `JIRA_VERIFY_TICKET` set), comment, update, workflow, fix versions, labels, priority, attach/download, create with JSON/parent, Xray search; optionally delete the ticket created by the script.

## Maximum coverage (aim for 100% ok where possible)

- **JIRA_VERIFY_PROJECT** (required): e.g. `AP` or `KBA`. Without it, all commands after pre-check are skipped.
- **JIRA_VERIFY_TICKET** (optional): Leave **unset** so the script creates a test ticket and can run `jira_create_ticket_basic` and `jira_delete_ticket`; the script will pick the first ticket from search for read-only tests.
- **JIRA_VERIFY_EMAIL** (optional): Set to a user email for `jira_get_account_by_email`. If unset, the script uses **JIRA_EMAIL** from `dmtools.env` when present.
- **JIRA_BASE_PATH**: Loaded from `dmtools.env` when not in env (needed for `jira_execute_request`).
- **accountId:** The script derives it from `jira_get_my_profile` so `jira_get_user_profile` and `jira_assign_ticket_to` run when possible.
- **Fix versions / attachment download:** Some commands stay **skipped** when the project has no fix versions or when attachment URL parsing fails; these are environment-dependent.

```powershell
# Example: max coverage (project AP, script creates and deletes test ticket, email from dmtools.env)
$env:JIRA_VERIFY_PROJECT = "AP"
# leave JIRA_VERIFY_TICKET and JIRA_VERIFY_EMAIL unset to use first search result + JIRA_EMAIL from dmtools.env

.\tmp\jira-dmtools-verify\run-verify.ps1
```

Or copy `config.env.example` to `config.env` and set the variables there (do not commit `config.env`).

**Skill doc updates applied after verification:** `.cursor/skills/jira-dmtools/commands/search/SKILL.md` — note that search response may use `result` (array) in addition to `issues`; `commands/tickets-read/SKILL.md` — note that get_ticket may wrap payload in `result`.
