/**
 * Script to generate an XLSX file for Gantt visualization from
 * `outputs/jira-team-schedule.csv`.
 *
 * Input:
 *   - outputs/jira-team-schedule.csv
 *     Columns: Issue Key, Summary, Issue Type, Status, Jira Team,
 *              Role, Execution Team, Estimate Hours, Start, End
 *
 * Output:
 *   - outputs/jira-team-schedule.xlsx
 *     Same columns plus:
 *       - Duration Hours  (End - Start, in hours)
 *       - Duration Days   (End - Start, in Excel day units)
 *
 * Usage:
 *   npx ts-node generate-team-schedule-xlsx.ts
 */

import { readFileSync } from 'fs';
// csv-parse used for robust CSV parsing
// @ts-ignore
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

type CsvRow = Record<string, string>;

const INPUT_CSV_PATH = 'outputs/jira-team-schedule.csv';
const OUTPUT_XLSX_PATH = 'outputs/jira-team-schedule.xlsx';

/**
 * Helper to parse "YYYY-MM-DD HH:mm" into a Date.
 */
function parseDateTime(value: string | undefined): Date | null {
  if (!value || !value.trim()) {
    return null;
  }

  // Convert "YYYY-MM-DD HH:mm" → "YYYY-MM-DDTHH:mm"
  const isoLike = value.trim().replace(' ', 'T');
  const d = new Date(isoLike);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Main execution function to build the XLSX workbook.
 */
async function main() {
  // Load and parse CSV
  const csvContent = readFileSync(INPUT_CSV_PATH, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as CsvRow[];

  if (records.length === 0) {
    console.log(`No records found in ${INPUT_CSV_PATH}`);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Schedule');

  // Define columns with reasonable widths and date formats
  sheet.columns = [
    { header: 'Issue Key', key: 'issueKey', width: 14 },
    { header: 'Summary', key: 'summary', width: 60 },
    { header: 'Issue Type', key: 'issueType', width: 12 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Jira Team', key: 'jiraTeam', width: 16 },
    { header: 'Role', key: 'role', width: 8 },
    { header: 'Execution Team', key: 'executionTeam', width: 18 },
    { header: 'Estimate Hours', key: 'estimateHours', width: 14 },
    {
      header: 'Start',
      key: 'start',
      width: 20,
      style: { numFmt: 'yyyy-mm-dd hh:mm' },
    },
    {
      header: 'End',
      key: 'end',
      width: 20,
      style: { numFmt: 'yyyy-mm-dd hh:mm' },
    },
    { header: 'Duration Hours', key: 'durationHours', width: 16 },
    {
      header: 'Duration Days',
      key: 'durationDays',
      width: 16,
      // Excel will treat this as a number; formatting can be adjusted in UI
    },
  ];

  for (const row of records) {
    const issueKey = row['Issue Key'] || '';
    const summary = row['Summary'] || '';
    const issueType = row['Issue Type'] || '';
    const status = row['Status'] || '';
    const jiraTeam = row['Jira Team'] || '';
    const role = row['Role'] || '';
    const executionTeam = row['Execution Team'] || '';

    const estimateHoursRaw = row['Estimate Hours'];
    const estimateHours = estimateHoursRaw
      ? Number(estimateHoursRaw)
      : NaN;

    const start = parseDateTime(row['Start']);
    const end = parseDateTime(row['End']);

    // Skip rows that don't have valid start/end
    if (!start || !end) {
      continue;
    }

    const diffMs = end.getTime() - start.getTime();
    const durationHours = diffMs / (1000 * 60 * 60);
    const durationDays = diffMs / (1000 * 60 * 60 * 24);

    sheet.addRow({
      issueKey,
      summary,
      issueType,
      status,
      jiraTeam,
      role,
      executionTeam,
      estimateHours: isNaN(estimateHours) ? null : estimateHours,
      start,
      end,
      durationHours,
      durationDays,
    });
  }

  // Freeze header row
  sheet.views = [
    {
      state: 'frozen',
      xSplit: 0,
      ySplit: 1,
      topLeftCell: 'A2',
      activeCell: 'A2',
    },
  ];

  await workbook.xlsx.writeFile(OUTPUT_XLSX_PATH);
  console.log(
    `Generated XLSX schedule with ${sheet.rowCount - 1} data rows at ${OUTPUT_XLSX_PATH}`
  );
}

// Execute when run as a script
main().catch((error) => {
  console.error('XLSX schedule generation failed:', error);
  process.exit(1);
});



