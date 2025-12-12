# DMTools File Commands Reference

Complete reference guide with usage examples for all File operations.

| # | Name | Short Description | Usage Example |
|---|------|-------------------|---------------|
| 1 | `file_read` | Read file content from working directory | `dmtools file_read outputs/response.md` |
| 2 | `file_write` | Write content to file in working directory | `dmtools file_write --data '{"path": "outputs/result.md", "content": "# Result"}'` |
| 3 | `file_validate_json` | Validate JSON string and return detailed error information if invalid | `dmtools file_validate_json --data '{"json": "{\"key\": \"value\"}"}'` |
| 4 | `file_validate_json_file` | Validate JSON file and return detailed error information if invalid | `dmtools file_validate_json_file outputs/response.json` |

---

## Enhanced Example

### `file_write`
```bash
# With JSON data flag
dmtools file_write --data '{
  "path": "outputs/response.md",
  "content": "# Response\n\nThis is the response content."
}'

# With heredoc
dmtools file_write <<EOF
{
  "path": "inbox/raw/teams_messages/1729766400000-messages.json",
  "content": "{\"messages\": []}"
}
EOF

# Write markdown file
dmtools file_write --data '{
  "path": "docs/guide.md",
  "content": "# Guide\n\nContent here."
}'
```

---

## Notes

- All commands return JSON output by default
- Use `--verbose` flag for detailed logging
- Use `--debug` flag for debug output and error messages
- File operations are sandboxed to the working directory for security
- Path traversal attempts are blocked automatically
- JSON validation provides detailed error information including line and column numbers
- Supports reading from `outputs/` and `input/` directories
- Parent directories are created automatically when writing files

**Required Environment Variables:**
- No special configuration required - file operations work within the current working directory
