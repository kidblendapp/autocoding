# JIRA dmtools verification results

Generated: 2026-02-19 18:12:09

## Config
- JIRA_VERIFY_PROJECT: AP
- JIRA_VERIFY_TICKET: AP-2
- JIRA_VERIFY_EMAIL: (set if used)

## Results

| Command | ExitCode | Status | Notes |
|---------|----------|--------|-------|
| dmtools --version | 0 | ok | CLI available |
| jira_get_my_profile | 0 | ok | auth OK |
| jira_get_account_by_email | 0 | ok |  |
| jira_get_user_profile | 0 | skipped | no accountId from profile |
| jira_get_issue_types | 0 | ok |  |
| jira_get_project_statuses | 0 | ok |  |
| jira_get_components | 0 | ok |  |
| jira_get_fields | 0 | ok |  |
| jira_get_field_custom_code | 0 | ok |  |
| jira_get_all_fields_with_name | 0 | ok |  |
| jira_search_by_jql | 0 | ok |  |
| jira_search_by_page | 0 | ok |  |
| jira_search_with_pagination | 0 | ok |  |
| jira_get_ticket | 0 | ok |  |
| jira_get_subtasks | 0 | ok |  |
| jira_get_comments | 0 | ok |  |
| jira_get_transitions | 0 | ok |  |
| jira_get_issue_link_types | 0 | ok |  |
| jira_get_fix_versions | 0 | ok |  |
| jira_execute_request | 0 | ok |  |
| jira_create_ticket_basic | 0 | skipped | using existing JIRA_VERIFY_TICKET |
| jira_post_comment | 0 | ok |  |
| jira_post_comment_if_not_exists | 0 | ok |  |
| jira_update_description | 0 | ok |  |
| jira_update_field | 0 | ok |  |
| jira_move_to_status | 0 | ok |  |
| jira_assign_ticket_to | 0 | skipped | no accountId |
| jira_set_fix_version | 0 | skipped | no fix versions in project |
| jira_remove_fix_version | 0 | skipped | no fix versions |
| jira_add_fix_version | 0 | ok |  |
| jira_add_label | 0 | ok |  |
| jira_set_priority | 0 | ok |  |
| jira_attach_file_to_ticket | 0 | ok |  |
| jira_download_attachment | 0 | skipped | no attachment href |
| jira_update_ticket | 0 | ok |  |
| jira_create_ticket_with_json | 0 | ok |  |
| jira_create_ticket_with_parent | 0 | ok |  |
| jira_xray_search_tickets | 0 | ok |  |
| jira_delete_ticket | 0 | skipped | no ticket created by script |

---

## Summary
See table above. Commands: ok = exit 0 and expected output; fail = non-zero or error; skipped = missing config or dependency. When a command fails, retry with positional args or fix \--data\ JSON quoting; update the skill in \.cursor/skills/jira-dmtools/commands/<group>/SKILL.md\ if the working form differs from the documented one.

Done.
