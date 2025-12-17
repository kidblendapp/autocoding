## Issues/Notes

All acceptance criteria implemented successfully. No blocking issues encountered.

**Note**: The change history extraction feature requires `dmtools` CLI to be installed and configured with proper Jira API credentials. If `dmtools` is not available or Jira API access fails, the feature will log an error but will not break the existing `ingest-csv` functionality.

## Approach

Implemented change history extraction as an integrated feature within the existing `ingest-csv` command workflow. The implementation follows the existing codebase patterns and architecture:

1. **Configuration Extension**: Extended the schedule configuration to support an optional `changeHistory` section with JQL query and field mapping configuration.

2. **Service Layer**: Created two new services:
   - `change-history-extractor.ts`: Handles JQL query execution, ticket retrieval, and changelog extraction using `dmtools` CLI
   - `change-history-csv-generator.ts`: Transforms changelog data to CSV format and writes to timestamped directories

3. **Integration**: Integrated change history extraction to run in parallel with schedule calculation, ensuring it doesn't block or break existing functionality if it fails.

4. **Error Handling**: Implemented graceful error handling - change history extraction errors are logged but don't fail the entire command.

## Files Modified

- `src/config/types.ts`: Added `ChangeHistoryConfig` and `ChangeHistoryFieldMapping` interfaces, extended `ScheduleConfig` and `RawScheduleConfig` to support optional change history configuration
- `src/config/validator.ts`: Extended validation logic to validate optional `changeHistory` section (JQL query must be a non-empty string if provided, field mapping is optional)
- `src/cli/commands/ingest-csv.ts`: Integrated change history extraction to run automatically when configuration is provided
- `src/config/__tests__/validator.test.ts`: Added comprehensive tests for change history configuration validation

## Files Created

- `src/services/change-history-extractor.ts`: Service for executing JQL queries, retrieving ticket changelogs, and filtering for Status, Sprint, and Story Points fields
- `src/services/change-history-csv-generator.ts`: Service for generating CSV files with change history data in timestamped directories
- `src/services/__tests__/change-history-extractor.test.ts`: Unit tests for change history extractor with mocked `dmtools` CLI calls
- `src/services/__tests__/change-history-csv-generator.test.ts`: Unit tests for CSV generator covering various scenarios including empty data, special characters, and multiple tickets

## Test Coverage

**Configuration Validator Tests** (added to existing test suite):
- Valid change history configuration with JQL query
- Change history with field mapping (sprint and story points)
- Change history with partial field mapping
- Validation errors for missing/invalid JQL
- Validation errors for invalid field mapping
- Configuration without change history (backward compatibility)

**Change History Extractor Tests**:
- Extraction of change history for multiple tickets matching JQL query
- Handling of empty JQL query results
- Filtering for only Status, Sprint, and Story Points fields (excluding other fields)
- Handling tickets with no changelog data
- Error handling for API failures
- Custom field mapping support

**CSV Generator Tests**:
- CSV file generation with proper header and data rows
- Timestamped directory creation (format: YYYYMMDD_HH)
- Handling empty changes array
- CSV escaping for special characters (quotes, commas, newlines)
- Support for all three field types (Status, Sprint, Story Points)
- Multiple tickets handling

**All Tests**: 157 tests passing (12 test files)
