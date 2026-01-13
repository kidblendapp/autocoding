# Quick Start Guide - Schedule Configuration UI Tool

## Prerequisites

- Node.js (LTS v18+)
- npm or pnpm
- JIRA API access (for JIRA operations)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install UI dependencies:
```bash
cd ui
npm install
cd ..
```

## Running the Application

### Development Mode

Start both the backend API server and React frontend:

```bash
npm run ui:dev
```

This will:
- Start Express backend on `http://localhost:3001`
- Start React dev server on `http://localhost:3000`
- Automatically proxy API requests from frontend to backend

Open `http://localhost:3000` in your browser.

### Production Build

1. Build the backend:
```bash
npm run build
```

2. Build the frontend:
```bash
npm run ui:build
```

3. Start the backend server:
```bash
npm run ui:start
```

Serve the `ui/dist` directory with a static file server (e.g., `npx serve ui/dist`).

## Configuration Files

The UI tool manages two configuration files:

1. **`jira-config.json`** - JIRA connection settings
   - JIRA instance URL
   - Email and API token
   - Project name

2. **`schedule_config.json`** - Schedule calculation settings
   - Project dates
   - Sprint duration
   - Team configurations
   - Work types and sequences
   - JQL query for ticket filtering
   - Predecessor link types (multiple)
   - Estimate type (story points or hours)
   - Non-working days (holidays)

3. **`extracted-values.json`** - Extracted JIRA field values (auto-generated)
   - Issue types, fix versions, link types
   - Teams, components, statuses
   - Used for populating dropdowns in configuration UI

## Features

### Configuration Tab
- **JIRA Configuration**: Edit JIRA connection settings
- **Project Settings**: 
  - Configure project dates, sprint duration
  - Extract all field values from JIRA with single "Extract All Values" button
  - Configure JQL query for ticket filtering during extraction (replaces deprecated issue types/fix versions fields)
  - Configure planning issue types and fix versions (for planning operations, not extraction)
  - Configure multiple predecessor link types (defaults auto-selected)
  - Set estimate type (Story Points or Hours)
  - Manage non-working days (supports individual dates and date ranges)
- **Teams Configuration**: 
  - Manage teams (add/remove, configure velocity, members, match rules)
  - Match rules use dropdowns populated with extracted values (components, statuses, teams)
- **Work Types**: Configure work types and execution sequences

### JIRA Operations Tab
- Extract all tickets from JIRA (with optional change history)
- Inspect individual ticket fields for custom field configuration

### Story Management Tab
- Decompose stories according to team schedule config
- Manage dependencies (blocks, has to be done before)
- *Note: Full implementation coming soon*

### Gantt Charts Tab
- Generate Excel Gantt chart from schedule CSV
- Generate HTML Gantt chart with improved UI
- Preview Gantt data

## Troubleshooting

### Port Already in Use

If port 3000 or 3001 is already in use:

1. Change the React dev server port in `ui/vite.config.ts`
2. Change the backend port in `src/ui-server/server.ts` or set `PORT` environment variable

### API Connection Errors

- Ensure the backend server is running on port 3001
- Check browser console for CORS errors
- Verify the proxy configuration in `ui/vite.config.ts`

### Configuration Not Saving

- Check file permissions in the project root
- Verify `jira-config.json` and `schedule_config.json` exist
- Check backend logs for errors

## Next Steps

1. Configure JIRA connection in the Configuration tab
2. Set up your project settings and teams
3. Extract tickets from JIRA
4. Generate Gantt charts

For more details, see [ui/README.md](ui/README.md).
