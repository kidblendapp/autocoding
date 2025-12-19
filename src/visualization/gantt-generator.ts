/**
 * Gantt chart data transformation module.
 * 
 * Transforms CSV schedule data into vis-timeline format for visualization.
 */

import { readFileSync } from 'fs';
// @ts-ignore - csv-parse does not ship full TypeScript typings
import { parse } from 'csv-parse/sync';
import { logger } from '../utils/logger';

type CsvRow = Record<string, string>;

/**
 * Team segment row from CSV schedule file.
 */
export interface TeamSegmentRow {
  issueKey: string;
  summary: string;
  issueType: string;
  status: string;
  jiraTeam: string;
  role: 'BA' | 'Dev' | 'QA';
  executionTeam: string;
  estimateHours: number;
  storyPoints?: number;
  originalEstimate?: number;
  latestSprint?: string;
  start: string; // Local datetime string "YYYY-MM-DD HH:mm"
  end: string;   // Local datetime string "YYYY-MM-DD HH:mm"
}

/**
 * Gantt chart item for vis-timeline.
 */
export interface GanttItem {
  id: string;              // Unique: "PSME-259-BA"
  content: string;         // Display: "PSME-259 - BA"
  start: Date;             // Parsed start datetime
  end: Date;               // Parsed end datetime
  group: string;           // Group ID (Execution Team)
  className: string;       // CSS class for role styling
  title: string;           // Tooltip with full details
  type: 'range';           // vis-timeline item type
}

/**
 * Gantt chart group for vis-timeline.
 */
export interface GanttGroup {
  id: string;              // Group ID (sprint ID or sprint-team combination ID)
  content: string;         // Group display name
  nestedGroups?: string[]; // Child group IDs (for sprint groups)
  className?: string;      // Optional CSS class for styling
}

/**
 * Complete Gantt chart data structure.
 */
export interface GanttData {
  items: GanttItem[];
  groups: GanttGroup[];
}

/**
 * Parses a datetime string in "YYYY-MM-DD HH:mm" format to a Date object.
 * 
 * @param dateTimeStr - Datetime string in "YYYY-MM-DD HH:mm" format
 * @returns Parsed Date object
 * @throws Error if date format is invalid
 */
export function parseDateTime(dateTimeStr: string): Date {
  // Format: "YYYY-MM-DD HH:mm"
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  
  if (!match) {
    throw new Error(`Invalid datetime format: ${dateTimeStr}. Expected format: YYYY-MM-DD HH:mm`);
  }

  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1, // Month is 0-indexed
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10)
  );

  // Validate the date is valid
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateTimeStr}`);
  }

  return date;
}

/**
 * Converts a CSV row to a GanttItem.
 * 
 * @param row - Team segment row from CSV
 * @param groupId - Group ID to assign this item to (sprint-team combination)
 * @returns Gantt chart item
 */
export function parseTeamSegmentRow(row: TeamSegmentRow, groupId: string): GanttItem {
  const id = `${row.issueKey}-${row.role}`;
  const content = `${row.issueKey} - ${row.role}`;
  
  // Parse datetime strings
  const start = parseDateTime(row.start);
  const end = parseDateTime(row.end);
  
  // Generate CSS class for role-based styling
  const className = `role-${row.role.toLowerCase()}`;
  
  // Build enhanced tooltip with required information
  const tooltipParts = [
    `Issue Key: ${row.issueKey}`,
    `Start: ${row.start}`,
    `Finish: ${row.end}`,
    `Calculated Estimate: ${row.estimateHours}h`,
  ];
  
  // Add Story Points if available, otherwise Original Estimate
  if (row.storyPoints !== undefined && row.storyPoints !== null) {
    tooltipParts.push(`Story Points: ${row.storyPoints}`);
  } else if (row.originalEstimate !== undefined && row.originalEstimate !== null) {
    tooltipParts.push(`Original Estimate: ${row.originalEstimate}h`);
  }
  
  const title = tooltipParts.join('\n');

  return {
    id,
    content,
    start,
    end,
    group: groupId,
    className,
    title,
    type: 'range',
  };
}

/**
 * Loads sprint data from sprints CSV file to get completion dates.
 * Returns a Map: sprintName -> completionDate (ISO string)
 */
function loadSprintDates(): Map<string, string> {
  const sprintDates = new Map<string, string>();
  
  try {
    const sprintsPath = 'outputs/jira-export-sprints.csv';
    const sprintsContent = readFileSync(sprintsPath, 'utf-8');
    const sprintRecords = parse(sprintsContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as CsvRow[];

    for (const sprintRow of sprintRecords) {
      const sprintName = sprintRow['Name'] || '';
      // Prefer Complete Date, fall back to End Date
      const completeDate = sprintRow['Complete Date'] || sprintRow['End Date'] || '';
      
      if (sprintName && completeDate) {
        sprintDates.set(sprintName, completeDate);
      }
    }
    
    logger.info(`Loaded ${sprintDates.size} sprint dates from ${sprintsPath}`);
  } catch (error) {
    logger.warn(`Could not load sprint dates: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return sprintDates;
}

/**
 * Extracts sprint number from sprint name (e.g., "PSME Sp 8" -> 8).
 * Returns the number if found, or Infinity if not found (for sorting).
 */
function extractSprintNumber(sprintName: string): number {
  // Match patterns like "PSME Sp 8", "PSME Sp 10", etc.
  const match = sprintName.match(/\bSp\s+(\d+)\b/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return Infinity;
}

/**
 * Creates nested groups structure: Sprint (parent) → Team (child).
 * 
 * @param rows - Array of team segment rows
 * @returns Object containing parent groups (sprints) and all groups (sprints + teams)
 */
export function createNestedGroups(rows: TeamSegmentRow[]): {
  allGroups: GanttGroup[];
  sprintToTeamMap: Map<string, Set<string>>;
} {
  // Map: sprint name -> set of teams in that sprint
  const sprintToTeamMap = new Map<string, Set<string>>();
  
  // Collect all sprints and teams
  for (const row of rows) {
    const sprintName = row.latestSprint || 'No Sprint';
    const team = row.executionTeam;
    
    if (!sprintToTeamMap.has(sprintName)) {
      sprintToTeamMap.set(sprintName, new Set<string>());
    }
    
    if (team) {
      sprintToTeamMap.get(sprintName)!.add(team);
    }
  }
  
  // Load sprint dates for sorting
  const sprintDates = loadSprintDates();
  
  // Get all sprint names and sort them
  const sprintNames = Array.from(sprintToTeamMap.keys());
  const sprintsWithSprint = sprintNames.filter(s => s !== 'No Sprint');
  
  // Sort sprints by completion date (taking year into account), or by sprint number
  const sortedSprintNames = sprintsWithSprint.sort((a, b) => {
    const aDate = sprintDates.get(a);
    const bDate = sprintDates.get(b);
    
    // If both have dates, sort by date (taking year into account)
    if (aDate && bDate) {
      return aDate.localeCompare(bDate);
    }
    
    // If only one has a date, prioritize it
    if (aDate && !bDate) {
      return -1;
    }
    if (!aDate && bDate) {
      return 1;
    }
    
    // If neither has a date, try to extract sprint numbers
    const aNum = extractSprintNumber(a);
    const bNum = extractSprintNumber(b);
    
    if (aNum !== Infinity && bNum !== Infinity) {
      return aNum - bNum;
    }
    
    // Fall back to alphabetical
    return a.localeCompare(b);
  });
  
  // Add "No Sprint" at the end if it exists
  const sortedSprintNamesFinal = [...sortedSprintNames, ...(sprintNames.includes('No Sprint') ? ['No Sprint'] : [])];
  
  const allGroups: GanttGroup[] = [];
  const teamGroups: GanttGroup[] = [];
  
  // First pass: Create child groups (teams) and collect their IDs
  const sprintGroupData: Array<{ sprintId: string; sprintName: string; teamIds: string[] }> = [];
  
  for (const sprintName of sortedSprintNamesFinal) {
    const sprintId = `sprint-${sprintName}`;
    const teams = Array.from(sprintToTeamMap.get(sprintName)!).sort();
    const teamIds: string[] = [];
    
    // Create child groups (teams) for this sprint
    for (const team of teams) {
      const teamId = `${sprintId}-team-${team}`;
      teamIds.push(teamId);
      teamGroups.push({
        id: teamId,
        content: team,
        className: 'team-group',
      });
    }
    
    sprintGroupData.push({ sprintId, sprintName, teamIds });
  }
  
  // Second pass: Create parent groups (sprints) with nestedGroups reference
  for (const { sprintId, sprintName, teamIds } of sprintGroupData) {
    allGroups.push({
      id: sprintId,
      content: sprintName,
      nestedGroups: teamIds,
      className: 'sprint-group',
    });
  }
  
  // Add all team groups after sprint groups (vis-timeline needs parent groups first)
  allGroups.push(...teamGroups);
  
  return {
    allGroups,
    sprintToTeamMap,
  };
}

/**
 * Creates groups from unique Execution Teams (legacy function, kept for compatibility).
 * 
 * @param rows - Array of team segment rows
 * @returns Array of Gantt groups
 * @deprecated Use createNestedGroups instead
 */
export function createGroups(rows: TeamSegmentRow[]): GanttGroup[] {
  const uniqueTeams = new Set<string>();
  
  for (const row of rows) {
    if (row.executionTeam) {
      uniqueTeams.add(row.executionTeam);
    }
  }
  
  return Array.from(uniqueTeams)
    .sort()
    .map(team => ({
      id: team,
      content: team,
    }));
}

/**
 * Reads and parses CSV schedule file into TeamSegmentRow array.
 * 
 * @param csvPath - Path to CSV file
 * @returns Array of team segment rows
 * @throws Error if file cannot be read or parsed
 */
export function readScheduleCsv(csvPath: string): TeamSegmentRow[] {
  try {
    const csvContent = readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as CsvRow[];

    if (records.length === 0) {
      logger.warn(`No records found in ${csvPath}`);
      return [];
    }

    const rows: TeamSegmentRow[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // Header is row 1

      // Extract fields with fallback column names
      const issueKey = record['Issue Key'] || record['issueKey'] || '';
      const summary = record['Summary'] || record['summary'] || '';
      const issueType = record['Issue Type'] || record['issueType'] || '';
      const status = record['Status'] || record['status'] || '';
      const jiraTeam = record['Jira Team'] || record['jiraTeam'] || '';
      const role = (record['Role'] || record['role']) as 'BA' | 'Dev' | 'QA';
      const executionTeam = record['Execution Team'] || record['executionTeam'] || '';
      const estimateHoursStr = record['Estimate Hours'] || record['estimateHours'] || '0';
      const storyPointsStr = record['Story Points'] || record['storyPoints'] || '';
      const originalEstimateStr = record['Original Estimate'] || record['originalEstimate'] || '';
      const latestSprint = record['Latest Sprint'] || record['latestSprint'] || '';
      const start = record['Start'] || record['start'] || '';
      const end = record['End'] || record['end'] || '';

      // Validate required fields
      if (!issueKey || !role || !start || !end || !executionTeam) {
        logger.warn(
          `Skipping row ${rowNumber}: missing required fields (Issue Key, Role, Start, End, or Execution Team)`,
          rowNumber
        );
        continue;
      }

      // Validate role
      if (role !== 'BA' && role !== 'Dev' && role !== 'QA') {
        logger.warn(`Skipping row ${rowNumber}: invalid role "${role}"`, rowNumber);
        continue;
      }

      // Parse numeric fields
      const estimateHours = parseFloat(estimateHoursStr);
      if (isNaN(estimateHours) || estimateHours < 0) {
        logger.warn(`Row ${rowNumber}: invalid Estimate Hours "${estimateHoursStr}", using 0`, rowNumber);
      }

      const storyPoints = storyPointsStr ? parseFloat(storyPointsStr) : undefined;
      if (storyPoints !== undefined && (isNaN(storyPoints) || storyPoints < 0)) {
        logger.warn(`Row ${rowNumber}: invalid Story Points "${storyPointsStr}", ignoring`, rowNumber);
      }

      const originalEstimate = originalEstimateStr ? parseFloat(originalEstimateStr) : undefined;
      if (originalEstimate !== undefined && (isNaN(originalEstimate) || originalEstimate < 0)) {
        logger.warn(`Row ${rowNumber}: invalid Original Estimate "${originalEstimateStr}", ignoring`, rowNumber);
      }

      rows.push({
        issueKey,
        summary,
        issueType,
        status,
        jiraTeam,
        role,
        executionTeam,
        estimateHours: isNaN(estimateHours) ? 0 : estimateHours,
        storyPoints: storyPoints !== undefined && !isNaN(storyPoints) ? storyPoints : undefined,
        originalEstimate: originalEstimate !== undefined && !isNaN(originalEstimate) ? originalEstimate : undefined,
        latestSprint: latestSprint || undefined,
        start,
        end,
      });
    }

    return rows;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to read CSV file ${csvPath}: ${error.message}`);
      throw error;
    }
    throw new Error(`Failed to read CSV file ${csvPath}`);
  }
}

/**
 * Transforms CSV schedule data into Gantt chart format with nested groups (Sprint → Team).
 * 
 * @param csvPath - Path to CSV schedule file
 * @returns Gantt chart data structure
 * @throws Error if CSV cannot be read or transformed
 */
export function transformScheduleToGanttData(csvPath: string): GanttData {
  logger.info(`Reading schedule CSV from ${csvPath}`);
  
  const rows = readScheduleCsv(csvPath);
  
  if (rows.length === 0) {
    logger.warn('No valid rows found in CSV file');
    return {
      items: [],
      groups: [],
    };
  }

  logger.info(`Processing ${rows.length} schedule rows`);

  // Create nested groups structure (Sprint → Team)
  const { allGroups, sprintToTeamMap } = createNestedGroups(rows);
  logger.info(`Created ${allGroups.length} groups (${sprintToTeamMap.size} sprints with teams)`);

  // Transform rows to Gantt items, assigning them to sprint-team combination groups
  const items: GanttItem[] = [];
  const errors: Array<{ row: TeamSegmentRow; error: string }> = [];

  for (const row of rows) {
    try {
      // Determine sprint name (use "No Sprint" if empty)
      const sprintName = row.latestSprint || 'No Sprint';
      const sprintId = `sprint-${sprintName}`;
      
      // Create group ID: sprint-team combination
      const groupId = `${sprintId}-team-${row.executionTeam}`;
      
      // Parse row with the group ID
      const item = parseTeamSegmentRow(row, groupId);
      items.push(item);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ row, error: errorMsg });
      logger.warn(`Failed to parse row for ${row.issueKey}-${row.role}: ${errorMsg}`);
    }
  }

  if (errors.length > 0) {
    logger.warn(`Failed to parse ${errors.length} out of ${rows.length} rows`);
  }

  logger.info(`Generated ${items.length} Gantt items`);

  return {
    items,
    groups: allGroups,
  };
}

