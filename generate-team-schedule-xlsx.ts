/**
 * Script to generate an XLSX file for Gantt visualization from
 * `outputs/jira-team-schedule.csv`.
 *
 * Input:
 *   - outputs/jira-team-schedule.csv
 *     Columns: Issue Key, Summary, Issue Type, Status, Jira Team,
 *              Role, Execution Team, Estimate Hours, Story Points,
 *              Latest Sprint, Start, End
 *
 * Output:
 *   - outputs/jira-team-schedule.xlsx
 *     Sheets:
 *       - Schedule: Raw schedule data with Duration Hours and Duration Days
 *       - Gantt Chart: Chart-ready data with formulas that auto-update
 *       - Chart Instructions: Instructions for creating the Gantt chart
 *
 * Usage:
 *   npx ts-node generate-team-schedule-xlsx.ts
 */

import { readFileSync } from 'fs';
// csv-parse used for robust CSV parsing
// @ts-ignore
import { parse } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';

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
    { header: 'Latest Sprint', key: 'latestSprint', width: 30 },
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
    const latestSprint = row['Latest Sprint'] || '';

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
      latestSprint: latestSprint || null,
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

  // Create Gantt Chart sheet with formulas
  createGanttChartSheet(workbook, sheet);

  // Create Chart Instructions sheet
  createChartInstructionsSheet(workbook);

  await workbook.xlsx.writeFile(OUTPUT_XLSX_PATH);
  console.log(
    `Generated XLSX schedule with ${sheet.rowCount - 1} data rows at ${OUTPUT_XLSX_PATH}`
  );
}

/**
 * Creates a Gantt Chart sheet with formulas that reference the Schedule sheet.
 * The data is prepared optimally for creating a horizontal bar chart in Excel.
 */
function createGanttChartSheet(workbook: ExcelJS.Workbook, scheduleSheet: ExcelJS.Worksheet): void {
  const chartSheet = workbook.addWorksheet('Gantt Chart');
  
  // Define column headers
  chartSheet.columns = [
    { header: 'Task Label', key: 'taskLabel', width: 50 },
    { header: 'Execution Team', key: 'executionTeam', width: 18 },
    { header: 'Role', key: 'role', width: 8 },
    { header: 'Start Date', key: 'startDate', width: 18, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
    { header: 'End Date', key: 'endDate', width: 18, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
    { header: 'Days from Project Start', key: 'daysFromStart', width: 22 },
    { header: 'Duration Days', key: 'durationDays', width: 16 },
    { header: 'Issue Key', key: 'issueKey', width: 14 },
  ];

  const dataRowCount = scheduleSheet.rowCount - 1; // Exclude header
  
  if (dataRowCount === 0) {
    // Add a note if no data
    chartSheet.getCell('A2').value = 'No schedule data available';
    return;
  }

  // Calculate minimum start date for "Days from Start" calculation
  // We'll use a formula that references the Schedule sheet
  const minStartFormula = `MIN(Schedule!J2:J${scheduleSheet.rowCount})`;

  // Add data rows with formulas
  for (let i = 2; i <= scheduleSheet.rowCount; i++) {
    const row = chartSheet.addRow({});
    
    // Set formulas using cell.value with formula property
    row.getCell('taskLabel').value = { formula: `Schedule!A${i}&" - "&Schedule!B${i}&" ("&Schedule!F${i}&")"` };
    row.getCell('executionTeam').value = { formula: `Schedule!G${i}` };
    row.getCell('role').value = { formula: `Schedule!F${i}` };
    row.getCell('startDate').value = { formula: `Schedule!J${i}` };
    row.getCell('endDate').value = { formula: `Schedule!K${i}` };
    row.getCell('daysFromStart').value = { formula: `Schedule!J${i}-${minStartFormula}` };
    row.getCell('durationDays').value = { formula: `Schedule!M${i}` };
    row.getCell('issueKey').value = { formula: `Schedule!A${i}` };

    // Format the daysFromStart and durationDays columns as numbers with 2 decimal places
    row.getCell('daysFromStart').numFmt = '0.00';
    row.getCell('durationDays').numFmt = '0.00';
  }

  // Add a helper column header for sorting (Execution Team + Start Date as text for sorting)
  const headerRow = chartSheet.getRow(1);
  headerRow.getCell(9).value = 'Sort Helper';
  chartSheet.getColumn(9).width = 20;
  chartSheet.getColumn(9).key = 'sortHelper';
  
  // Add sort helper formulas for each data row
  // Note: chartSheet rows start at 2 (row 1 is header), and they correspond to Schedule rows 2+
  for (let i = 2; i <= chartSheet.rowCount; i++) {
    const scheduleRow = i; // chartSheet row i corresponds to Schedule row i
    // Create a sortable string: ExecutionTeam_StartDate
    chartSheet.getRow(i).getCell('sortHelper').value = { 
      formula: `Schedule!G${scheduleRow}&"_"&TEXT(Schedule!J${scheduleRow},"yyyymmddhhmm")` 
    };
  }

  // Add a note at the top explaining how to create the chart
  chartSheet.insertRow(1, [
    'Chart Data - Select columns A, F, and G (Task Label, Days from Start, Duration Days) to create a horizontal bar chart. Data is grouped by Execution Team.',
  ]);
  chartSheet.mergeCells('A1:I1');
  chartSheet.getCell('A1').font = { bold: true, italic: true };
  chartSheet.getCell('A1').alignment = { wrapText: true, vertical: 'middle' };
  chartSheet.getRow(1).height = 40;

  // Freeze header row (now row 2 after inserting instruction row)
  chartSheet.views = [
    {
      state: 'frozen',
      xSplit: 0,
      ySplit: 2, // Freeze both instruction row and header row
      topLeftCell: 'A3',
      activeCell: 'A3',
    },
  ];
  
  // Note: Named ranges would be helpful but ExcelJS doesn't support addNamedRange directly
  // Users can create named ranges manually in Excel using:
  // Formulas > Name Manager > New
  // Or reference the ranges directly: 'Gantt Chart'!$A$3:$A$<lastRow>
}

/**
 * Creates a Chart Instructions sheet with step-by-step instructions for creating the Gantt chart.
 */
function createChartInstructionsSheet(workbook: ExcelJS.Workbook): void {
  const instructionsSheet = workbook.addWorksheet('Chart Instructions');
  
  instructionsSheet.columns = [
    { header: 'Step', key: 'step', width: 8 },
    { header: 'Instruction', key: 'instruction', width: 100 },
  ];

  const instructions = [
    {
      step: '1',
      instruction: 'Go to the "Gantt Chart" sheet',
    },
    {
      step: '2',
      instruction: 'Select the data range including headers (columns A through H, starting from row 2)',
    },
    {
      step: '3',
      instruction: 'Go to Insert > Charts > Bar Chart > Stacked Bar Chart (or Horizontal Bar Chart)',
    },
    {
      step: '4',
      instruction: 'Right-click on the chart and select "Select Data"',
    },
    {
      step: '5',
      instruction: 'In "Chart data range", ensure it includes: Task Label, Days from Start, and Duration Days columns',
    },
    {
      step: '6',
      instruction: 'Set "Task Label" column as the Y-axis (Categories)',
    },
    {
      step: '7',
      instruction: 'Set "Days from Start" and "Duration Days" as the data series',
    },
    {
      step: '8',
      instruction: 'Format the X-axis to show dates or days',
    },
    {
      step: '9',
      instruction: 'Customize colors, labels, and formatting as needed',
    },
    {
      step: '10',
      instruction: 'The chart will automatically update when you modify values in the Schedule sheet',
    },
    {
      step: '',
      instruction: '',
    },
    {
      step: 'Tip:',
      instruction: 'You can filter or sort the Gantt Chart sheet by Execution Team or Role to create separate charts for different teams',
    },
    {
      step: '',
      instruction: '',
    },
    {
      step: 'Alternative:',
      instruction: 'For a simpler approach, select columns A (Task Label), F (Days from Start), and G (Duration Days), then insert a horizontal bar chart. Excel will automatically use the first column for labels and the other columns as data series.',
    },
    {
      step: '',
      instruction: '',
    },
    {
      step: 'Note:',
      instruction: 'All formulas in the Gantt Chart sheet reference the Schedule sheet, so any changes to Schedule data will automatically update the chart data. The chart itself will refresh when you update the data.',
    },
  ];

  instructions.forEach((inst) => {
    instructionsSheet.addRow({
      step: inst.step,
      instruction: inst.instruction,
    });
  });

  // Format header row
  const headerRow = instructionsSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Auto-fit columns
  instructionsSheet.columns.forEach((col) => {
    if (col.key === 'step') {
      col.width = 8;
    } else {
      col.width = 100;
    }
  });
}

// Execute when run as a script
main().catch((error) => {
  console.error('XLSX schedule generation failed:', error);
  process.exit(1);
});



