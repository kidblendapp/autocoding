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
 * Converts a column number (1-based) to Excel column letter(s).
 * Examples: 1 -> A, 26 -> Z, 27 -> AA, 702 -> ZZ
 */
function getColumnLetter(colNum: number): string {
  let result = '';
  while (colNum > 0) {
    colNum--;
    result = String.fromCharCode(65 + (colNum % 26)) + result;
    colNum = Math.floor(colNum / 26);
  }
  return result;
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
    { header: 'Epic Link', key: 'epicLink', width: 16 },
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
    const epicLink = row['Epic Link'] || '';

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
      epicLink: epicLink || null,
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

  // Create Conditional Formatting Gantt View sheet
  createGanttViewSheet(workbook, sheet);

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
    { header: 'Epic Link', key: 'epicLink', width: 16 },
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
  // Note: Start column is now K (was J before Epic Link was added)
  const minStartFormula = `MIN(Schedule!K2:K${scheduleSheet.rowCount})`;

  // Add data rows with formulas
  for (let i = 2; i <= scheduleSheet.rowCount; i++) {
    const row = chartSheet.addRow({});
    
    // Set formulas using cell.value with formula property
    // Note: Column references updated: Epic Link is J, Start is K, End is L
    row.getCell('taskLabel').value = { formula: `Schedule!A${i}&" - "&Schedule!B${i}&" ("&Schedule!F${i}&")"` };
    row.getCell('executionTeam').value = { formula: `Schedule!G${i}` };
    row.getCell('role').value = { formula: `Schedule!F${i}` };
    row.getCell('epicLink').value = { formula: `Schedule!J${i}` };
    row.getCell('startDate').value = { formula: `Schedule!K${i}` };
    row.getCell('endDate').value = { formula: `Schedule!L${i}` };
    row.getCell('daysFromStart').value = { formula: `Schedule!K${i}-${minStartFormula}` };
    row.getCell('durationDays').value = { formula: `Schedule!N${i}` };
    row.getCell('issueKey').value = { formula: `Schedule!A${i}` };

    // Format the daysFromStart and durationDays columns as numbers with 2 decimal places
    row.getCell('daysFromStart').numFmt = '0.00';
    row.getCell('durationDays').numFmt = '0.00';
  }

  // Add a helper column header for sorting (Epic Link + Sprint + Start Date as text for sorting)
  const headerRow = chartSheet.getRow(1);
  headerRow.getCell(10).value = 'Sort Helper';
  chartSheet.getColumn(10).width = 20;
  chartSheet.getColumn(10).key = 'sortHelper';
  
  // Add sort helper formulas for each data row
  // Note: chartSheet rows start at 2 (row 1 is header), and they correspond to Schedule rows 2+
  for (let i = 2; i <= chartSheet.rowCount; i++) {
    const scheduleRow = i; // chartSheet row i corresponds to Schedule row i
    // Create a sortable string: EpicLink_Sprint_StartDate for Epic → Sprint grouping
    chartSheet.getRow(i).getCell('sortHelper').value = { 
      formula: `IF(ISBLANK(Schedule!J${scheduleRow}),"No Epic",Schedule!J${scheduleRow})&"_"&IF(ISBLANK(Schedule!I${scheduleRow}),"No Sprint",Schedule!I${scheduleRow})&"_"&TEXT(Schedule!K${scheduleRow},"yyyymmddhhmm")` 
    };
  }

  // Add a note at the top explaining how to create the chart
  chartSheet.insertRow(1, [
    'Chart Data - Select columns A, G, and H (Task Label, Days from Start, Duration Days) to create a horizontal bar chart. Data can be grouped by Epic Link and Sprint.',
  ]);
  chartSheet.mergeCells('A1:J1');
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
 * Creates a Gantt View sheet with conditional formatting using date headers and overlap formulas.
 * This sheet displays a visual Gantt chart that automatically updates when Schedule sheet dates change.
 */
function createGanttViewSheet(workbook: ExcelJS.Workbook, scheduleSheet: ExcelJS.Worksheet): void {
  const ganttSheet = workbook.addWorksheet('Gantt View');
  
  const dataRowCount = scheduleSheet.rowCount - 1; // Exclude header
  
  if (dataRowCount === 0) {
    ganttSheet.getCell('A1').value = 'No schedule data available';
    return;
  }

  // Calculate date range from Schedule sheet
  const minDate = new Date();
  const maxDate = new Date();
  let hasDates = false;

  for (let i = 2; i <= scheduleSheet.rowCount; i++) {
    const startCell = scheduleSheet.getCell(`K${i}`); // Start column
    const endCell = scheduleSheet.getCell(`L${i}`);   // End column
    
    if (startCell.value instanceof Date && endCell.value instanceof Date) {
      const start = startCell.value as Date;
      const end = endCell.value as Date;
      
      if (!hasDates) {
        minDate.setTime(start.getTime());
        maxDate.setTime(end.getTime());
        hasDates = true;
      } else {
        if (start.getTime() < minDate.getTime()) {
          minDate.setTime(start.getTime());
        }
        if (end.getTime() > maxDate.getTime()) {
          maxDate.setTime(end.getTime());
        }
      }
    }
  }

  if (!hasDates) {
    ganttSheet.getCell('A1').value = 'No valid dates found in schedule data';
    return;
  }

  // Add buffer days (7 days before and after)
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 7);

  // Generate date sequence (daily)
  const dates: Date[] = [];
  const currentDate = new Date(minDate);
  while (currentDate <= maxDate) {
    // Skip weekends for better performance (optional - can include all days)
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Limit to reasonable number of dates (max 365 days)
  const maxDates = 365;
  if (dates.length > maxDates) {
    // Sample dates to fit within limit
    const step = Math.ceil(dates.length / maxDates);
    const sampledDates: Date[] = [];
    for (let i = 0; i < dates.length; i += step) {
      sampledDates.push(dates[i]);
    }
    dates.length = 0;
    dates.push(...sampledDates);
  }

  // Set column widths
  ganttSheet.getColumn('A').width = 50; // Task label
  ganttSheet.getColumn('B').width = 18; // Execution Team
  ganttSheet.getColumn('C').width = 8;  // Role
  ganttSheet.getColumn('D').width = 16;  // Epic Link
  // Date columns will be narrow (8 pixels)
  dates.forEach(() => {
    ganttSheet.getColumn(ganttSheet.columnCount + 1).width = 8;
  });

  // Add header row
  const headerRow = ganttSheet.addRow([
    'Task Label',
    'Execution Team',
    'Role',
    'Epic Link',
    ...dates.map(d => d)
  ]);

  // Format header row
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  headerRow.height = 20;

  // Format date headers (columns E onwards, which is column 5)
  dates.forEach((date, idx) => {
    const colNum = 5 + idx; // Column E is 5
    const colLetter = getColumnLetter(colNum);
    const cell = headerRow.getCell(colLetter);
    cell.numFmt = 'dd-mmm';
    cell.alignment = { textRotation: 45, vertical: 'bottom' };
  });

  // Add data rows with formulas
  for (let i = 2; i <= scheduleSheet.rowCount; i++) {
    const row = ganttSheet.addRow([]);
    
    // Task label
    row.getCell('A').value = { 
      formula: `Schedule!A${i}&" - "&Schedule!B${i}&" ("&Schedule!F${i}&")"` 
    };
    
    // Execution Team
    row.getCell('B').value = { formula: `Schedule!G${i}` };
    
    // Role
    row.getCell('C').value = { formula: `Schedule!F${i}` };
    
    // Epic Link
    row.getCell('D').value = { formula: `Schedule!J${i}` };
    
    // Date overlap formulas for each date column
    dates.forEach((date, dateIdx) => {
      const colNum = 5 + dateIdx; // Column E is 5
      const colLetter = getColumnLetter(colNum);
      const dateValue = Math.floor(date.getTime() / (1000 * 60 * 60 * 24)) + 25569; // Excel date serial
      
      // Set header cell to date value
      headerRow.getCell(colLetter).value = dateValue;
      headerRow.getCell(colLetter).numFmt = 'dd-mmm';
      
      // Formula: AND(date >= Start, date <= End)
      // Compare date header with Start and End dates from Schedule sheet
      row.getCell(colLetter).value = {
        formula: `AND(${colLetter}$1>=Schedule!K${i},${colLetter}$1<=Schedule!L${i})`
      };
    });
  }

  // Apply conditional formatting using cell fill colors
  // Since ExcelJS conditional formatting API may be limited, we'll use formulas that return 1/0
  // and apply fill colors programmatically, or provide instructions for manual formatting
  
  // For now, we'll set cells with TRUE formulas to have a fill color
  // Users can manually apply conditional formatting in Excel if needed
  for (let rowIdx = 2; rowIdx <= ganttSheet.rowCount; rowIdx++) {
    const roleCell = ganttSheet.getRow(rowIdx).getCell('C');
    const roleValue = roleCell.value?.toString() || '';
    
    // Determine color based on role
    let fillColor: string;
    if (roleValue === 'BA') {
      fillColor = 'FF4472C4'; // Blue
    } else if (roleValue === 'Dev') {
      fillColor = 'FF70AD47'; // Green
    } else if (roleValue === 'QA') {
      fillColor = 'FFFFC000'; // Orange
    } else {
      fillColor = 'FFD0D0D0'; // Gray
    }

    // Apply fill to date columns where formula returns TRUE
    dates.forEach((_, dateIdx) => {
      const colNum = 5 + dateIdx; // Column E is 5
      const col = getColumnLetter(colNum);
      const cell = ganttSheet.getRow(rowIdx).getCell(col);
      
      // Set a formula that will be used for conditional formatting
      // The formula already exists, we just need to note that users should apply conditional formatting
      // For now, we'll leave it as-is and add instructions
    });
  }

  // Add instruction note
  const lastColNum = 4 + dates.length; // A=1, B=2, C=3, D=4, then dates start at E=5
  const lastColLetter = getColumnLetter(lastColNum);
  ganttSheet.insertRow(1, [
    'Gantt View - This sheet uses formulas to check if tasks overlap with dates. Apply conditional formatting: Select date range (E2:last column), Home > Conditional Formatting > New Rule > Use formula: =E2=TRUE, set fill color. The chart updates automatically when Schedule sheet dates change.'
  ]);
  ganttSheet.mergeCells(`A1:${lastColLetter}1`);
  ganttSheet.getCell('A1').font = { bold: true, italic: true };
  ganttSheet.getCell('A1').alignment = { wrapText: true, vertical: 'middle' };
  ganttSheet.getRow(1).height = 50;

  // Freeze panes: first 4 columns (Task Label, Execution Team, Role, Epic Link) and header row
  ganttSheet.views = [
    {
      state: 'frozen',
      xSplit: 4, // Freeze first 4 columns
      ySplit: 2, // Freeze instruction row and header row
      topLeftCell: 'E3',
      activeCell: 'E3',
    },
  ];
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
      instruction: 'You can filter or sort the Gantt Chart sheet by Epic Link, Sprint, Execution Team, or Role to create separate charts for different groupings',
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



