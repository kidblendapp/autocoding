# DMTools Jira Commands Reference

Complete reference guide with usage examples for all Jira commands.

| # | Name | Short Description | Usage Example |
|---|------|-------------------|---------------|
| 1 | `jira_get_ticket` | Get ticket details with optional field filtering | `dmtools jira_get_ticket PROJ-123` |
| 2 | `jira_create_ticket_basic` | Create a new ticket with basic fields | `dmtools jira_create_ticket_basic PROJ Task "Fix login bug" "Users cannot log in"` |
| 3 | `jira_create_ticket_with_json` | Create ticket with custom fields using JSON | `dmtools jira_create_ticket_with_json --data '{"project": "PROJ", "fieldsJson": {...}}'` |
| 4 | `jira_update_ticket` | Update ticket using JSON parameters | `dmtools jira_update_ticket --data '{"key": "PROJ-123", "params": {...}}'` |
| 5 | `jira_delete_ticket` | Delete a ticket (cannot be undone) | `dmtools jira_delete_ticket PROJ-123` |
| 6 | `jira_search_by_jql` | Search tickets using JQL and return all results | `dmtools jira_search_by_jql "project = PROJ AND status = Open" "summary,status"` |
| 7 | `jira_search_by_page` | Search with pagination support using nextPageToken | `dmtools jira_search_by_page --data '{"jql": "...", "nextPageToken": "", "fields": [...]}'` |
| 8 | `jira_post_comment` | Add a comment to a ticket | `dmtools jira_post_comment PROJ-123 "This is a test comment"` |
| 9 | `jira_post_comment_if_not_exists` | Post comment only if it doesn't already exist | `dmtools jira_post_comment_if_not_exists --data '{"key": "PROJ-123", "comment": "..."}'` |
| 10 | `jira_get_comments` | Get all comments for a ticket | `dmtools jira_get_comments PROJ-123` |
| 11 | `jira_get_fields` | Get all available fields for a project | `dmtools jira_get_fields PROJ` |
| 12 | `jira_get_field_custom_code` | Get custom field code for a human-readable field name | `dmtools jira_get_field_custom_code --data '{"project": "PROJ", "fieldName": "Story Points"}'` |
| 13 | `jira_clear_field` | Clear (delete) a field value in a ticket | `dmtools jira_clear_field --data '{"key": "PROJ-123", "field": "customfield_10001"}'` |
| 14 | `jira_get_transitions` | Get all available transitions (statuses) for a ticket | `dmtools jira_get_transitions PROJ-123` |
| 15 | `jira_move_to_status` | Move ticket to a specific status | `dmtools jira_move_to_status --data '{"key": "PROJ-123", "statusName": "In Review"}'` |
| 16 | `jira_move_to_status_with_resolution` | Move to status and set resolution | `dmtools jira_move_to_status_with_resolution --data '{"key": "PROJ-123", "statusName": "Done", "resolution": "Fixed"}'` |
| 17 | `jira_get_fix_versions` | Get all fix versions for a project | `dmtools jira_get_fix_versions PROJ` |
| 18 | `jira_set_fix_version` | Set fix version (replaces existing) | `dmtools jira_set_fix_version --data '{"key": "PROJ-123", "fixVersion": "1.0.0"}'` |
| 19 | `jira_add_fix_version` | Add fix version without removing existing ones | `dmtools jira_add_fix_version --data '{"key": "PROJ-123", "fixVersion": "1.1.0"}'` |
| 20 | `jira_remove_fix_version` | Remove a fix version | `dmtools jira_remove_fix_version --data '{"key": "PROJ-123", "fixVersion": "1.0.0"}'` |
| 21 | `jira_get_issue_link_types` | Get all available issue link types | `dmtools jira_get_issue_link_types` |
| 22 | `jira_link_issues` | Link two issues with a relationship type | `dmtools jira_link_issues --data '{"sourceKey": "PROJ-123", "anotherKey": "PROJ-456", "relationship": "blocks"}'` |
| 23 | `jira_get_my_profile` | Get the current user's profile | `dmtools jira_get_my_profile` |
| 24 | `jira_assign_ticket_to` | Assign ticket to a user | `dmtools jira_assign_ticket_to --data '{"key": "PROJ-123", "userName": "user@company.com"}'` |
| 25 | `jira_get_components` | Get all components for a project | `dmtools jira_get_components PROJ` |
| 26 | `jira_set_priority` | Set ticket priority | `dmtools jira_set_priority --data '{"key": "PROJ-123", "priority": "High"}'` |
| 27 | `jira_get_subtasks` | Get all subtasks of a parent ticket | `dmtools jira_get_subtasks PROJ-123` |
| 28 | `jira_download_attachment` | Download an attachment by URL | `dmtools jira_download_attachment --data '{"href": "https://company.atlassian.net/attachments/12345/file.pdf"}'` |

---

## Enhanced Example

### `jira_get_ticket`
```bash
# Get all fields
dmtools jira_get_ticket PROJ-123

# Get specific fields (comma-separated)
dmtools jira_get_ticket PROJ-123 summary,description,status

# With JSON data flag
dmtools jira_get_ticket --data '{"key": "PROJ-123", "fields": ["summary", "description", "status", "assignee"]}'

# With heredoc
dmtools jira_get_ticket <<EOF
{
  "key": "PROJ-123",
  "fields": ["summary", "description", "status", "assignee", "priority"]
}
EOF
```

---

## Notes

- All commands return JSON output by default
- Use `--verbose` flag for detailed logging
- Use `--debug` flag for debug output and error messages
- All commands require proper Jira configuration in `dmtools.env` file

**Required Environment Variables:**
- `JIRA_BASE_PATH` - Your Jira instance URL (e.g., `https://company.atlassian.net`)
- `JIRA_EMAIL` - Your Jira email address
- `JIRA_API_TOKEN` - Jira API token (create at: https://id.atlassian.com/manage-profile/security/api-tokens)
- `JIRA_AUTH_TYPE` - Authentication type (optional, default: `basic`)
