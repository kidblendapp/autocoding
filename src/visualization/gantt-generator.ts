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
  epicLink?: string;
  fixVersion?: string;
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
 * Creates nested groups structure: Epic (parent) → Sprint (child).
 * 
 * @param rows - Array of team segment rows
 * @returns Object containing parent groups (epics) and all groups (epics + sprints)
 */
export function createEpicSprintGroups(rows: TeamSegmentRow[]): {
  allGroups: GanttGroup[];
  epicToSprintMap: Map<string, Set<string>>;
} {
  // Map: epic name -> set of sprints in that epic
  const epicToSprintMap = new Map<string, Set<string>>();
  
  // Collect all epics and sprints
  for (const row of rows) {
    const epicName = row.epicLink || 'No Epic';
    const sprintName = row.latestSprint || 'No Sprint';
    
    if (!epicToSprintMap.has(epicName)) {
      epicToSprintMap.set(epicName, new Set<string>());
    }
    
    epicToSprintMap.get(epicName)!.add(sprintName);
  }
  
  // Load sprint dates for sorting
  const sprintDates = loadSprintDates();
  
  // Helper to extract sprint number for sorting
  const extractSprintNumber = (sprintName: string): number => {
    const match = sprintName.match(/\bSp\s+(\d+)\b/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return Infinity;
  };
  
  // Sort sprints within each epic
  const sortedEpicSprints = new Map<string, string[]>();
  epicToSprintMap.forEach((sprints, epicName) => {
    const sprintArray = Array.from(sprints);
    const sprintsWithSprint = sprintArray.filter(s => s !== 'No Sprint');
    
    // Sort sprints by completion date or sprint number
    const sortedSprintNames = sprintsWithSprint.sort((a, b) => {
      const aDate = sprintDates.get(a);
      const bDate = sprintDates.get(b);
      
      if (aDate && bDate) {
        return aDate.localeCompare(bDate);
      }
      
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      
      const aNum = extractSprintNumber(a);
      const bNum = extractSprintNumber(b);
      
      if (aNum !== Infinity && bNum !== Infinity) {
        return aNum - bNum;
      }
      
      return a.localeCompare(b);
    });
    
    // Add "No Sprint" at the end if it exists
    const sortedSprintNamesFinal = [...sortedSprintNames, ...(sprintArray.includes('No Sprint') ? ['No Sprint'] : [])];
    sortedEpicSprints.set(epicName, sortedSprintNamesFinal);
  });
  
  // Sort epics alphabetically (or by some other criteria)
  const sortedEpicNames = Array.from(epicToSprintMap.keys()).sort();
  // Put "No Epic" at the end
  const epicNamesFinal = [
    ...sortedEpicNames.filter(e => e !== 'No Epic'),
    ...(sortedEpicNames.includes('No Epic') ? ['No Epic'] : [])
  ];
  
  const allGroups: GanttGroup[] = [];
  const sprintGroups: GanttGroup[] = [];
  
  // First pass: Create child groups (sprints) and collect their IDs
  const epicGroupData: Array<{ epicId: string; epicName: string; sprintIds: string[] }> = [];
  
  for (const epicName of epicNamesFinal) {
    const epicId = `epic-${epicName}`;
    const sprints = sortedEpicSprints.get(epicName) || [];
    const sprintIds: string[] = [];
    
    // Create child groups (sprints) for this epic
    for (const sprint of sprints) {
      const sprintId = `${epicId}-sprint-${sprint}`;
      sprintIds.push(sprintId);
      sprintGroups.push({
        id: sprintId,
        content: sprint,
        className: 'sprint-group',
      });
    }
    
    epicGroupData.push({ epicId, epicName, sprintIds });
  }
  
  // Second pass: Create parent groups (epics) with nestedGroups reference
  for (const { epicId, epicName, sprintIds } of epicGroupData) {
    allGroups.push({
      id: epicId,
      content: epicName,
      nestedGroups: sprintIds,
      className: 'epic-group',
    });
  }
  
  // Add all sprint groups after epic groups (vis-timeline needs parent groups first)
  allGroups.push(...sprintGroups);
  
  return {
    allGroups,
    epicToSprintMap,
  };
}

/**
 * Creates nested groups structure: Sprint (parent) → Team (child).
 * 
 * @param rows - Array of team segment rows
 * @returns Object containing parent groups (sprints) and all groups (sprints + teams)
 * @deprecated Use createEpicSprintGroups instead for Epic → Sprint grouping
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
 * Creates nested groups structure: Sprint (parent) → Epic (child).
 * 
 * @param rows - Array of team segment rows
 * @returns Object containing parent groups (sprints) and all groups (sprints + epics)
 */
export function createSprintEpicGroups(rows: TeamSegmentRow[]): {
  allGroups: GanttGroup[];
  sprintToEpicMap: Map<string, Set<string>>;
} {
  // Map: sprint name -> set of epics in that sprint
  const sprintToEpicMap = new Map<string, Set<string>>();
  
  // Collect all sprints and epics
  for (const row of rows) {
    const sprintName = row.latestSprint || 'No Sprint';
    const epicName = row.epicLink || 'No Epic';
    
    if (!sprintToEpicMap.has(sprintName)) {
      sprintToEpicMap.set(sprintName, new Set<string>());
    }
    
    sprintToEpicMap.get(sprintName)!.add(epicName);
  }
  
  // Load sprint dates for sorting
  const sprintDates = loadSprintDates();
  
  // Get all sprint names and sort them
  const sprintNames = Array.from(sprintToEpicMap.keys());
  const sprintsWithSprint = sprintNames.filter(s => s !== 'No Sprint');
  
  // Sort sprints by completion date or sprint number
  const sortedSprintNames = sprintsWithSprint.sort((a, b) => {
    const aDate = sprintDates.get(a);
    const bDate = sprintDates.get(b);
    
    if (aDate && bDate) {
      return aDate.localeCompare(bDate);
    }
    
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    
    const aNum = extractSprintNumber(a);
    const bNum = extractSprintNumber(b);
    
    if (aNum !== Infinity && bNum !== Infinity) {
      return aNum - bNum;
    }
    
    return a.localeCompare(b);
  });
  
  // Add "No Sprint" at the end if it exists
  const sortedSprintNamesFinal = [...sortedSprintNames, ...(sprintNames.includes('No Sprint') ? ['No Sprint'] : [])];
  
  const allGroups: GanttGroup[] = [];
  const epicGroups: GanttGroup[] = [];
  
  // First pass: Create child groups (epics) and collect their IDs
  const sprintGroupData: Array<{ sprintId: string; sprintName: string; epicIds: string[] }> = [];
  
  for (const sprintName of sortedSprintNamesFinal) {
    const sprintId = `sprint-${sprintName}`;
    const epics = Array.from(sprintToEpicMap.get(sprintName)!).sort();
    const epicIds: string[] = [];
    
    // Create child groups (epics) for this sprint
    for (const epic of epics) {
      const epicId = `${sprintId}-epic-${epic}`;
      epicIds.push(epicId);
      epicGroups.push({
        id: epicId,
        content: epic,
        className: 'epic-group',
      });
    }
    
    sprintGroupData.push({ sprintId, sprintName, epicIds });
  }
  
  // Second pass: Create parent groups (sprints) with nestedGroups reference
  for (const { sprintId, sprintName, epicIds } of sprintGroupData) {
    allGroups.push({
      id: sprintId,
      content: sprintName,
      nestedGroups: epicIds,
      className: 'sprint-group',
    });
  }
  
  // Add all epic groups after sprint groups (vis-timeline needs parent groups first)
  allGroups.push(...epicGroups);
  
  return {
    allGroups,
    sprintToEpicMap,
  };
}

/**
 * Creates nested groups structure: Epic (parent) → Team (child).
 * 
 * @param rows - Array of team segment rows
 * @returns Object containing parent groups (epics) and all groups (epics + teams)
 */
export function createEpicTeamGroups(rows: TeamSegmentRow[]): {
  allGroups: GanttGroup[];
  epicToTeamMap: Map<string, Set<string>>;
} {
  // Map: epic name -> set of teams in that epic
  const epicToTeamMap = new Map<string, Set<string>>();
  
  // Collect all epics and teams
  for (const row of rows) {
    const epicName = row.epicLink || 'No Epic';
    const team = row.executionTeam;
    
    if (!epicToTeamMap.has(epicName)) {
      epicToTeamMap.set(epicName, new Set<string>());
    }
    
    if (team) {
      epicToTeamMap.get(epicName)!.add(team);
    }
  }
  
  // Sort epics alphabetically (or by some other criteria)
  const sortedEpicNames = Array.from(epicToTeamMap.keys()).sort();
  // Put "No Epic" at the end
  const epicNamesFinal = [
    ...sortedEpicNames.filter(e => e !== 'No Epic'),
    ...(sortedEpicNames.includes('No Epic') ? ['No Epic'] : [])
  ];
  
  const allGroups: GanttGroup[] = [];
  const teamGroups: GanttGroup[] = [];
  
  // First pass: Create child groups (teams) and collect their IDs
  const epicGroupData: Array<{ epicId: string; epicName: string; teamIds: string[] }> = [];
  
  for (const epicName of epicNamesFinal) {
    const epicId = `epic-${epicName}`;
    const teams = Array.from(epicToTeamMap.get(epicName)!).sort();
    const teamIds: string[] = [];
    
    // Create child groups (teams) for this epic
    for (const team of teams) {
      const teamId = `${epicId}-team-${team}`;
      teamIds.push(teamId);
      teamGroups.push({
        id: teamId,
        content: team,
        className: 'team-group',
      });
    }
    
    epicGroupData.push({ epicId, epicName, teamIds });
  }
  
  // Second pass: Create parent groups (epics) with nestedGroups reference
  for (const { epicId, epicName, teamIds } of epicGroupData) {
    allGroups.push({
      id: epicId,
      content: epicName,
      nestedGroups: teamIds,
      className: 'epic-group',
    });
  }
  
  // Add all team groups after epic groups (vis-timeline needs parent groups first)
  allGroups.push(...teamGroups);
  
  return {
    allGroups,
    epicToTeamMap,
  };
}

/**
 * Creates nested groups structure: Team (parent) → Sprint (child).
 * 
 * @param rows - Array of team segment rows
 * @returns Object containing parent groups (teams) and all groups (teams + sprints)
 */
export function createTeamSprintGroups(rows: TeamSegmentRow[]): {
  allGroups: GanttGroup[];
  teamToSprintMap: Map<string, Set<string>>;
} {
  // Map: team name -> set of sprints in that team
  const teamToSprintMap = new Map<string, Set<string>>();
  
  // Collect all teams and sprints
  for (const row of rows) {
    const team = row.executionTeam;
    const sprintName = row.latestSprint || 'No Sprint';
    
    if (team) {
      if (!teamToSprintMap.has(team)) {
        teamToSprintMap.set(team, new Set<string>());
      }
      
      teamToSprintMap.get(team)!.add(sprintName);
    }
  }
  
  // Load sprint dates for sorting
  const sprintDates = loadSprintDates();
  
  // Sort sprints within each team
  const sortedTeamSprints = new Map<string, string[]>();
  teamToSprintMap.forEach((sprints, teamName) => {
    const sprintArray = Array.from(sprints);
    const sprintsWithSprint = sprintArray.filter(s => s !== 'No Sprint');
    
    // Sort sprints by completion date or sprint number
    const sortedSprintNames = sprintsWithSprint.sort((a, b) => {
      const aDate = sprintDates.get(a);
      const bDate = sprintDates.get(b);
      
      if (aDate && bDate) {
        return aDate.localeCompare(bDate);
      }
      
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      
      const aNum = extractSprintNumber(a);
      const bNum = extractSprintNumber(b);
      
      if (aNum !== Infinity && bNum !== Infinity) {
        return aNum - bNum;
      }
      
      return a.localeCompare(b);
    });
    
    // Add "No Sprint" at the end if it exists
    const sortedSprintNamesFinal = [...sortedSprintNames, ...(sprintArray.includes('No Sprint') ? ['No Sprint'] : [])];
    sortedTeamSprints.set(teamName, sortedSprintNamesFinal);
  });
  
  // Sort teams alphabetically
  const sortedTeamNames = Array.from(teamToSprintMap.keys()).sort();
  
  const allGroups: GanttGroup[] = [];
  const sprintGroups: GanttGroup[] = [];
  
  // First pass: Create child groups (sprints) and collect their IDs
  const teamGroupData: Array<{ teamId: string; teamName: string; sprintIds: string[] }> = [];
  
  for (const teamName of sortedTeamNames) {
    const teamId = `team-${teamName}`;
    const sprints = sortedTeamSprints.get(teamName) || [];
    const sprintIds: string[] = [];
    
    // Create child groups (sprints) for this team
    for (const sprint of sprints) {
      const sprintId = `${teamId}-sprint-${sprint}`;
      sprintIds.push(sprintId);
      sprintGroups.push({
        id: sprintId,
        content: sprint,
        className: 'sprint-group',
      });
    }
    
    teamGroupData.push({ teamId, teamName, sprintIds });
  }
  
  // Second pass: Create parent groups (teams) with nestedGroups reference
  for (const { teamId, teamName, sprintIds } of teamGroupData) {
    allGroups.push({
      id: teamId,
      content: teamName,
      nestedGroups: sprintIds,
      className: 'team-group',
    });
  }
  
  // Add all sprint groups after team groups (vis-timeline needs parent groups first)
  allGroups.push(...sprintGroups);
  
  return {
    allGroups,
    teamToSprintMap,
  };
}

/**
 * Creates nested groups structure: Team (parent) → Epic (child).
 * 
 * @param rows - Array of team segment rows
 * @returns Object containing parent groups (teams) and all groups (teams + epics)
 */
export function createTeamEpicGroups(rows: TeamSegmentRow[]): {
  allGroups: GanttGroup[];
  teamToEpicMap: Map<string, Set<string>>;
} {
  // Map: team name -> set of epics in that team
  const teamToEpicMap = new Map<string, Set<string>>();
  
  // Collect all teams and epics
  for (const row of rows) {
    const team = row.executionTeam;
    const epicName = row.epicLink || 'No Epic';
    
    if (team) {
      if (!teamToEpicMap.has(team)) {
        teamToEpicMap.set(team, new Set<string>());
      }
      
      teamToEpicMap.get(team)!.add(epicName);
    }
  }
  
  // Sort teams alphabetically
  const sortedTeamNames = Array.from(teamToEpicMap.keys()).sort();
  
  const allGroups: GanttGroup[] = [];
  const epicGroups: GanttGroup[] = [];
  
  // First pass: Create child groups (epics) and collect their IDs
  const teamGroupData: Array<{ teamId: string; teamName: string; epicIds: string[] }> = [];
  
  for (const teamName of sortedTeamNames) {
    const teamId = `team-${teamName}`;
    const epics = Array.from(teamToEpicMap.get(teamName)!).sort();
    const epicIds: string[] = [];
    
    // Create child groups (epics) for this team
    for (const epic of epics) {
      const epicId = `${teamId}-epic-${epic}`;
      epicIds.push(epicId);
      epicGroups.push({
        id: epicId,
        content: epic,
        className: 'epic-group',
      });
    }
    
    teamGroupData.push({ teamId, teamName, epicIds });
  }
  
  // Second pass: Create parent groups (teams) with nestedGroups reference
  for (const { teamId, teamName, epicIds } of teamGroupData) {
    allGroups.push({
      id: teamId,
      content: teamName,
      nestedGroups: epicIds,
      className: 'team-group',
    });
  }
  
  // Add all epic groups after team groups (vis-timeline needs parent groups first)
  allGroups.push(...epicGroups);
  
  return {
    allGroups,
    teamToEpicMap,
  };
}

/**
 * Grouping level type for generic grouping function.
 */
export type GroupingLevel = 'fixVersion' | 'epic' | 'sprint' | 'team';

/**
 * Helper function to get value for a grouping level from a row.
 */
function getGroupingValue(row: TeamSegmentRow, level: GroupingLevel): string {
  switch (level) {
    case 'fixVersion':
      return row.fixVersion || 'No Fix Version';
    case 'epic':
      return row.epicLink || 'No Epic';
    case 'sprint':
      return row.latestSprint || 'No Sprint';
    case 'team':
      return row.executionTeam || 'No Team';
    default:
      return 'Unknown';
  }
}

/**
 * Helper function to get CSS class name for a grouping level.
 */
function getGroupingClassName(level: GroupingLevel): string {
  switch (level) {
    case 'fixVersion':
      return 'fixversion-group';
    case 'epic':
      return 'epic-group';
    case 'sprint':
      return 'sprint-group';
    case 'team':
      return 'team-group';
    default:
      return 'group';
  }
}

/**
 * Helper function to get level prefix for group ID.
 */
function getLevelPrefix(level: GroupingLevel): string {
  switch (level) {
    case 'fixVersion':
      return 'fixVersion';
    case 'epic':
      return 'epic';
    case 'sprint':
      return 'sprint';
    case 'team':
      return 'team';
    default:
      return 'level';
  }
}

/**
 * Sorts values for a grouping level appropriately.
 */
function sortGroupingValues(values: string[], level: GroupingLevel, sprintDates?: Map<string, string>): string[] {
  if (level === 'sprint') {
    const sprintDatesMap = sprintDates || loadSprintDates();
    const extractSprintNumber = (sprintName: string): number => {
      const match = sprintName.match(/\bSp\s+(\d+)\b/i);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
      return Infinity;
    };

    const sprintsWithSprint = values.filter(s => s !== 'No Sprint');
    const sortedSprintNames = sprintsWithSprint.sort((a, b) => {
      const aDate = sprintDatesMap.get(a);
      const bDate = sprintDatesMap.get(b);
      
      if (aDate && bDate) {
        return aDate.localeCompare(bDate);
      }
      
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      
      const aNum = extractSprintNumber(a);
      const bNum = extractSprintNumber(b);
      
      if (aNum !== Infinity && bNum !== Infinity) {
        return aNum - bNum;
      }
      
      return a.localeCompare(b);
    });
    
    return [...sortedSprintNames, ...(values.includes('No Sprint') ? ['No Sprint'] : [])];
  }
  
  // For other levels, sort alphabetically with "No X" at the end
  const noValuePattern = /^No (Fix Version|Epic|Sprint|Team)$/i;
  const sorted = values.filter(v => !noValuePattern.test(v)).sort();
  const noValues = values.filter(v => noValuePattern.test(v));
  return [...sorted, ...noValues];
}

/**
 * Creates nested groups structure based on an array of grouping levels.
 * Supports 0-4 levels of grouping with arbitrary ordering.
 * 
 * @param rows - Array of team segment rows
 * @param levels - Array of grouping levels (0-4 levels, e.g., ['fixVersion', 'epic', 'sprint'])
 * @returns Object containing all groups and a map for assigning items to groups
 */
export function createGenericGroups(
  rows: TeamSegmentRow[],
  levels: GroupingLevel[]
): {
  allGroups: GanttGroup[];
  groupIdMap: Map<string, string>; // Map from row key to final group ID
} {
  // Handle empty grouping (0 levels)
  if (levels.length === 0) {
    return {
      allGroups: [],
      groupIdMap: new Map(),
    };
  }

  // Build nested data structure
  type NestedMap = Map<string, NestedMap | Set<string>>;
  const rootMap: NestedMap = new Map();
  const sprintDates = loadSprintDates();

  // Collect all data into nested structure
  for (const row of rows) {
    let currentMap = rootMap;
    
    // Navigate/create nested maps for each level except the last
    for (let i = 0; i < levels.length - 1; i++) {
      const level = levels[i];
      const value = getGroupingValue(row, level);
      
      if (!currentMap.has(value)) {
        currentMap.set(value, new Map());
      }
      currentMap = currentMap.get(value) as NestedMap;
    }
    
    // For the last level, collect values in a Set
    const lastLevel = levels[levels.length - 1];
    const lastValue = getGroupingValue(row, lastLevel);
    
    if (!currentMap.has(lastValue)) {
      currentMap.set(lastValue, new Set<string>());
    }
    const lastSet = currentMap.get(lastValue) as Set<string>;
    lastSet.add(lastValue);
  }

  // Recursive function to build groups
  // Returns parent groups and child groups separately for proper ordering
  function buildGroups(
    map: NestedMap,
    levelIndex: number,
    parentIdPrefix: string
  ): { parentGroups: GanttGroup[]; childGroups: GanttGroup[]; childGroupIds: string[] } {
    const level = levels[levelIndex];
    const isLastLevel = levelIndex === levels.length - 1;
    const parentGroups: GanttGroup[] = [];
    const childGroups: GanttGroup[] = [];
    const childGroupIds: string[] = [];
    const levelPrefix = getLevelPrefix(level);
    
    // Get and sort values for this level
    const values = Array.from(map.keys());
    const sortedValues = sortGroupingValues(values, level, sprintDates);
    
    for (const value of sortedValues) {
      const groupId = parentIdPrefix 
        ? `${parentIdPrefix}-${levelPrefix}-${value}`
        : `${levelPrefix}-${value}`;
      
      if (isLastLevel) {
        // Leaf level - create group directly (these are child groups)
        childGroups.push({
          id: groupId,
          content: value,
          className: getGroupingClassName(level),
        });
        childGroupIds.push(groupId);
      } else {
        // Non-leaf level - recursively build children
        const childMap = map.get(value) as NestedMap;
        const { parentGroups: nestedParentGroups, childGroups: nestedChildGroups, childGroupIds: nestedChildIds } = buildGroups(
          childMap,
          levelIndex + 1,
          groupId
        );
        
        // Create parent group with nestedGroups reference
        parentGroups.push({
          id: groupId,
          content: value,
          nestedGroups: nestedChildIds,
          className: getGroupingClassName(level),
        });
        
        // Collect nested groups (parents first, then children)
        parentGroups.push(...nestedParentGroups);
        childGroups.push(...nestedChildGroups);
        childGroupIds.push(groupId);
      }
    }
    
    return { parentGroups, childGroups, childGroupIds };
  }

  // Build all groups (parents first, then children)
  const { parentGroups, childGroups } = buildGroups(rootMap, 0, '');
  const allGroups = [...parentGroups, ...childGroups];
  
  // Build map from row to final group ID
  const groupIdMap = new Map<string, string>();
  for (const row of rows) {
    const groupIdParts: string[] = [];
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const value = getGroupingValue(row, level);
      const prefix = getLevelPrefix(level);
      groupIdParts.push(`${prefix}-${value}`);
    }
    const finalGroupId = groupIdParts.join('-');
    groupIdMap.set(`${row.issueKey}-${row.role}`, finalGroupId);
  }

  return {
    allGroups,
    groupIdMap,
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
      const epicLink = record['Epic Link'] || record['EpicLink'] || record['epicLink'] || '';
      const fixVersion = record['Fix Version'] || record['FixVersion'] || record['fixVersion'] || '';
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
        epicLink: epicLink || undefined,
        fixVersion: fixVersion || undefined,
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
 * Converts old grouping type string to new grouping levels array.
 * 
 * @param groupingType - Old grouping type string
 * @returns Array of grouping levels
 */
export function convertGroupingTypeToLevels(
  groupingType: 'epicSprint' | 'sprintTeam' | 'sprintEpic' | 'epicTeam' | 'teamSprint' | 'teamEpic'
): GroupingLevel[] {
  switch (groupingType) {
    case 'epicSprint':
      return ['epic', 'sprint'];
    case 'sprintTeam':
      return ['sprint', 'team'];
    case 'sprintEpic':
      return ['sprint', 'epic'];
    case 'epicTeam':
      return ['epic', 'team'];
    case 'teamSprint':
      return ['team', 'sprint'];
    case 'teamEpic':
      return ['team', 'epic'];
    default:
      return ['epic', 'sprint'];
  }
}

/**
 * Transforms CSV schedule data into Gantt chart format with configurable grouping.
 * 
 * @param csvPath - Path to CSV schedule file
 * @param groupingLevels - Array of grouping levels (0-4 levels, e.g., ['fixVersion', 'epic', 'sprint'])
 * @returns Gantt chart data structure
 * @throws Error if CSV cannot be read or transformed
 */
export function transformScheduleToGanttData(
  csvPath: string,
  groupingLevels: GroupingLevel[] = ['epic', 'sprint']
): GanttData {
  logger.info(`Reading schedule CSV from ${csvPath}`);
  
  const rows = readScheduleCsv(csvPath);
  
  if (rows.length === 0) {
    logger.warn('No valid rows found in CSV file');
    return {
      items: [],
      groups: [],
    };
  }

  logger.info(`Processing ${rows.length} schedule rows with grouping levels: ${groupingLevels.join(' → ')}`);

  // Create groups using generic grouping function
  const { allGroups, groupIdMap } = createGenericGroups(rows, groupingLevels);
  logger.info(`Created ${allGroups.length} groups with ${groupingLevels.length} level(s) of grouping`);

  // Transform rows to Gantt items, assigning them to groups
  const items: GanttItem[] = [];
  const errors: Array<{ row: TeamSegmentRow; error: string }> = [];

  for (const row of rows) {
    try {
      const rowKey = `${row.issueKey}-${row.role}`;
      const groupId = groupIdMap.get(rowKey) || '';
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

