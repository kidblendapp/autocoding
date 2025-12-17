# JIRA Ticket Extraction

Extract all tickets from a JIRA project and export them to CSV format for use with the schedule calculation system.

## Usage

### Interactive Mode (No Config File)

When running without a config file, the tool will prompt you for JIRA credentials:

```bash
node dist/index.js --extract-jira
```

You will be prompted for:
- **JIRA Base URL**: e.g., `https://yourcompany.atlassian.net`
- **JIRA Email**: Your JIRA account email
- **JIRA API Token**: Your JIRA API token (see [How to get API token](#how-to-get-jira-api-token))
- **Project Name**: The project key (e.g., `AP`, `PROJ`)

### Using Config File

Create a config file (see `examples/jira-config.example.json`):

```json
{
  "jiraPath": "https://yourcompany.atlassian.net",
  "jiraEmail": "your.email@company.com",
  "jiraApiToken": "your-api-token-here",
  "projectName": "AP"
}
```

Then run:

```bash
node dist/index.js --extract-jira --config jira-config.json
```

### Custom Output File

Specify a custom output file:

```bash
node dist/index.js --extract-jira --config jira-config.json --output my-export.csv
```

## Output Format

The exported CSV file includes the following columns:

- Issue Key
- Summary
- Issue Type
- Story Points
- Original Estimate
- Component
- Parent Id
- Status
- Assignee
- Epic Link

This CSV format is compatible with the `--input` command for schedule calculation.

## How to Get JIRA API Token

1. Log in to your JIRA instance
2. Go to **Account Settings** → **Security** → **API tokens**
3. Click **Create API token**
4. Copy the token (you won't be able to see it again)

## Requirements

- `dmtools` CLI must be installed and available in PATH
- JIRA API access credentials (email and API token)
- Network access to your JIRA instance

## Example

```bash
# Extract tickets interactively
node dist/index.js --extract-jira

# Extract tickets using config file
node dist/index.js --extract-jira --config examples/jira-config.example.json --output backlog.csv

# Then use the exported CSV for schedule calculation
node dist/index.js --input backlog.csv
```


