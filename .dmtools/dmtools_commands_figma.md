# DMTools Figma Commands Reference

Complete reference guide with usage examples for all Figma commands.

| # | Name | Short Description | Usage Example |
|---|------|-------------------|---------------|
| 1 | `figma_get_file_structure` | Get JSON structure of a Figma file | `dmtools figma_get_file_structure "https://www.figma.com/file/abc123/MyDesign"` |
| 2 | `figma_get_screen_source` | Get screen/image URL for a design node | `dmtools figma_get_screen_source "https://www.figma.com/file/abc123/Design?node-id=1%3A2"` |
| 3 | `figma_get_icons` | Find and extract all exportable visual elements | `dmtools figma_get_icons "https://www.figma.com/file/abc123/Design"` |
| 4 | `figma_get_svg_content` | Get SVG content as text by node ID | `dmtools figma_get_svg_content --data '{"href": "https://www.figma.com/file/abc123/Design", "nodeId": "123:456"}'` |
| 5 | `figma_download_image_of_file` | Download entire design as image | `dmtools figma_download_image_of_file "https://www.figma.com/file/abc123/Design?node-id=1%3A2"` |
| 6 | `figma_download_image_as_file` | Download specific node as image file | `dmtools figma_download_image_as_file --data '{"href": "https://www.figma.com/file/abc123/Design", "nodeId": "123:456", "format": "png"}'` |

---

## Enhanced Example

### `figma_download_image_as_file`
```bash
# Positional arguments (if supported)
dmtools figma_download_image_as_file "https://www.figma.com/file/abc123/Design" "123:456" "png"

# With JSON data flag
dmtools figma_download_image_as_file --data '{
  "href": "https://www.figma.com/file/abc123/Design",
  "nodeId": "123:456",
  "format": "png"
}'

# With heredoc
dmtools figma_download_image_as_file <<EOF
{
  "href": "https://www.figma.com/file/abc123/Design",
  "nodeId": "123:456",
  "format": "jpg"
}
EOF
```

---

## Notes

- All commands return JSON output by default
- Use `--verbose` flag for detailed logging
- Use `--debug` flag for debug output and error messages
- All commands require proper Figma configuration in `dmtools.env` file
- Figma file URLs can include `node-id` parameter to target specific nodes
- Supported image formats: png, jpg, svg, pdf
- File downloads are saved to the working directory

**Required Environment Variables:**
- `FIGMA_API_KEY` - Figma Personal Access Token (create at: https://www.figma.com/settings)
- `FIGMA_BASE_PATH` - Figma API base path (optional, default: `https://api.figma.com`)
