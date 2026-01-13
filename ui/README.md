# Schedule Configuration UI Tool

A React-based web interface for configuring and managing JIRA extraction and schedule calculation settings.

## Features

- **Configuration Management**: 
  - Edit `schedule_config.json` and `jira-config.json` through a user-friendly interface
  - Extract all JIRA field values (issue types, fix versions, link types, teams, components, statuses) with a single button
  - Configure estimate type (Story Points or Hours)
  - Manage non-working days (supports individual dates and date ranges)
  - Configure JQL query for ticket filtering
  - Multi-select predecessor link types with auto-selected defaults
- **JIRA Operations**: Extract tickets and inspect ticket fields for custom field configuration
- **Story Management**: Decompose stories and manage dependencies
- **Gantt Generation**: Generate Excel and HTML Gantt charts

## Development

### Prerequisites

- Node.js (LTS v18+)
- npm or pnpm

### Running the Development Server

From the project root:

```bash
npm run ui:dev
```

This will start:
- Express backend server on `http://localhost:3001`
- React development server on `http://localhost:3000`

The React app will automatically proxy API requests to the backend.

### Building for Production

```bash
npm run ui:build
```

This creates an optimized production build in `ui/dist/`.

### Running Production Server

```bash
npm run ui:start
```

This starts only the Express backend server. You'll need to serve the built React app separately or use a static file server.

## Project Structure

```
ui/
├── src/
│   ├── components/      # React components
│   ├── services/       # API service layer
│   ├── types/          # TypeScript type definitions
│   └── App.tsx         # Main application component
├── public/             # Static assets
└── package.json        # Dependencies and scripts
```

## API Endpoints

The backend provides the following REST API endpoints:

### Configuration
- `GET /api/config/schedule` - Load schedule_config.json
- `PUT /api/config/schedule` - Save schedule_config.json
- `GET /api/config/jira` - Load jira-config.json
- `PUT /api/config/jira` - Save jira-config.json
- `GET /api/config/validate` - Validate configuration
- `GET /api/config/extracted-values` - Load extracted-values.json
- `PUT /api/config/extracted-values` - Save extracted-values.json
- `DELETE /api/config/extracted-values` - Clear extracted values

### JIRA Operations
- `POST /api/jira/extract` - Extract all tickets
- `GET /api/jira/ticket/:key` - Get ticket details
- `GET /api/jira/ticket/:key/fields` - Get ticket field structure
- `GET /api/jira/field-values/:field` - Extract values for a specific field (issueTypes, fixVersions, linkTypes, teams, components, statuses)
- `POST /api/jira/extract-all-fields` - Extract all field values at once and store in extracted-values.json

### Story Management
- `POST /api/stories/decompose` - Decompose stories
- `GET /api/stories/:key/dependencies` - Get dependencies
- `POST /api/stories/dependencies` - Update dependencies

### Gantt Generation
- `POST /api/gantt/excel` - Generate Excel Gantt chart
- `POST /api/gantt/html` - Generate HTML Gantt chart
- `GET /api/gantt/preview` - Get Gantt preview data
