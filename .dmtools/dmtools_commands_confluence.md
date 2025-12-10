# DMTools Confluence Commands Reference

Complete reference guide with usage examples for all Confluence commands.

| # | Name | Short Description | Usage Example |
|---|------|-------------------|---------------|
| 1 | `confluence_content_by_id` | Get page content by ID | `dmtools confluence_content_by_id 123456` |
| 2 | `confluence_content_by_title` | Get page by title (in default space) | `dmtools confluence_content_by_title "API Documentation"` |
| 3 | `confluence_content_by_title_and_space` | Get page by title in specific space | `dmtools confluence_content_by_title_and_space "Architecture Overview" "TECH"` |
| 4 | `confluence_search_content_by_text` | Search content using text query | `dmtools confluence_search_content_by_text "API documentation" 10` |
| 5 | `confluence_create_page` | Create a new page | `dmtools confluence_create_page --data '{"title": "New Page", "parentId": "123456", "body": "<p>Content</p>", "space": "TECH"}'` |
| 6 | `confluence_update_page` | Update an existing page | `dmtools confluence_update_page --data '{"contentId": "789012", "title": "Updated", "body": "<p>Content</p>", "space": "TECH"}'` |
| 7 | `confluence_update_page_with_history` | Update page and add history comment | `dmtools confluence_update_page_with_history --data '{"contentId": "789012", "title": "Updated", "body": "<p>Content</p>", "space": "TECH", "historyComment": "..."}'` |
| 8 | `confluence_get_children_by_id` | Get child pages by content ID | `dmtools confluence_get_children_by_id 123456` |
| 9 | `confluence_get_children_by_name` | Get child pages by parent page name | `dmtools confluence_get_children_by_name --data '{"spaceKey": "TECH", "contentName": "Parent Page"}'` |
| 10 | `confluence_get_content_attachments` | Get all attachments for a page | `dmtools confluence_get_content_attachments 123456` |
| 11 | `confluence_get_current_user_profile` | Get current user's profile | `dmtools confluence_get_current_user_profile` |

---

## Enhanced Example

### `confluence_search_content_by_text`
```bash
# Positional arguments
dmtools confluence_search_content_by_text "API documentation" 10

# With JSON data flag
dmtools confluence_search_content_by_text --data '{
  "query": "authentication",
  "limit": 20
}'

# With heredoc
dmtools confluence_search_content_by_text <<EOF
{
  "query": "REST API endpoints",
  "limit": 15
}
EOF
```

---

## Notes

- All commands return JSON output by default
- Use `--verbose` flag for detailed logging
- Use `--debug` flag for debug output and error messages
- All commands require proper Confluence configuration in `dmtools.env` file
- Body content must be in Confluence storage format (HTML-like markup)

**Required Environment Variables:**
- `CONFLUENCE_BASE_PATH` - Your Confluence instance URL (e.g., `https://company.atlassian.net/wiki`)
- `CONFLUENCE_EMAIL` - Your Confluence email address
- `CONFLUENCE_API_TOKEN` - Confluence API token (same as Jira token if using Atlassian Cloud)
- `CONFLUENCE_AUTH_TYPE` - Authentication type (optional, default: `basic`)
- `CONFLUENCE_DEFAULT_SPACE` - Default space key (optional)
