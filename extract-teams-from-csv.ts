import * as fs from 'fs';
import * as path from 'path';

interface TeamConfig {
  id: string;
  name: string;
  velocity?: number;
  velocityPeriod?: string;
  capacityPerDayHours?: number;
  estimationType?: string;
  members: string[];
  matchRules?: {
    components?: string[];
    labels?: string[];
    issueTypes?: string[];
  };
}

interface TeamsConfig {
  projectStartDate?: string;
  sprintDurationDays?: number;
  teams: TeamConfig[];
}

// Parse CSV and extract tags from summaries
function extractTagsFromSummary(summary: string): string[] {
  const tagRegex = /\[([^\]]+)\]/g;
  const tags: string[] = [];
  let match;
  
  while ((match = tagRegex.exec(summary)) !== null) {
    tags.push(match[1].trim());
  }
  
  return tags;
}

// Read CSV and extract user-tag mappings
function extractUserTags(csvPath: string): Map<string, Set<string>> {
  const userTags = new Map<string, Set<string>>();
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (handling quoted fields)
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField); // Add last field
    
    if (fields.length < 7) continue; // Need at least Summary (index 1) and Assignee (index 6)
    
    const summary = fields[1] || '';
    const assignee = fields[6] || '';
    
    if (!assignee || assignee.trim() === '') continue;
    
    const tags = extractTagsFromSummary(summary);
    
    if (tags.length > 0) {
      if (!userTags.has(assignee)) {
        userTags.set(assignee, new Set());
      }
      
      tags.forEach(tag => {
        userTags.get(assignee)!.add(tag);
      });
    }
  }
  
  return userTags;
}

// Generate teams config
function generateTeamsConfig(userTags: Map<string, Set<string>>): TeamsConfig {
  // Define team mappings
  const teamMappings: Record<string, string> = {
    'FE': 'FE',
    'BE': 'BE',
    'SFMC': 'SFMC',
    'CRM': 'CRM',
    'D365': 'CRM', // D365 might be part of CRM
  };
  
  // Initialize teams
  const teams: Record<string, { members: Set<string> }> = {
    'FE': { members: new Set() },
    'BE': { members: new Set() },
    'SFMC': { members: new Set() },
    'CRM': { members: new Set() },
  };
  
  // Assign users to teams based on their tags
  userTags.forEach((tags, user) => {
    tags.forEach(tag => {
      const teamId = teamMappings[tag.toUpperCase()];
      if (teamId && teams[teamId]) {
        teams[teamId].members.add(user);
      }
    });
  });
  
  // Convert to TeamConfig format
  const teamConfigs: TeamConfig[] = [
    {
      id: 'team-fe',
      name: 'Frontend Team',
      velocity: 30,
      velocityPeriod: 'sprint',
      members: Array.from(teams.FE.members).sort(),
      matchRules: {
        components: ['UI', 'Frontend']
      }
    },
    {
      id: 'team-be',
      name: 'Backend Team',
      velocity: 25,
      velocityPeriod: 'sprint',
      members: Array.from(teams.BE.members).sort(),
      matchRules: {
        components: ['Backend', 'API']
      }
    },
    {
      id: 'team-sfmc',
      name: 'SFMC Team',
      velocity: 20,
      velocityPeriod: 'sprint',
      members: Array.from(teams.SFMC.members).sort(),
      matchRules: {
        labels: ['SFMC', 'Marketing Cloud']
      }
    },
    {
      id: 'team-crm',
      name: 'CRM Team',
      velocity: 20,
      velocityPeriod: 'sprint',
      members: Array.from(teams.CRM.members).sort(),
      matchRules: {
        labels: ['CRM', 'D365', 'Dynamics']
      }
    }
  ];
  
  return {
    projectStartDate: '2025-01-01',
    sprintDurationDays: 10,
    teams: teamConfigs
  };
}

// Main execution
function main() {
  const csvPath = path.join(__dirname, 'outputs', 'jira-export.csv');
  const outputPath = path.join(__dirname, 'teams_config.json');
  
  console.log('Extracting user-tag mappings from CSV...');
  const userTags = extractUserTags(csvPath);
  
  console.log('\n=== User Tag Summary ===');
  const sortedUsers = Array.from(userTags.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  sortedUsers.forEach(([user, tags]) => {
    const tagList = Array.from(tags).sort().join(', ');
    console.log(`| ${user} | ${tagList} |`);
  });
  
  console.log('\nGenerating teams_config.json...');
  const config = generateTeamsConfig(userTags);
  
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`\n✅ Teams config saved to ${outputPath}`);
  
  // Print summary
  console.log('\n=== Teams Summary ===');
  config.teams.forEach(team => {
    console.log(`${team.name} (${team.id}): ${team.members.length} members`);
    if (team.members.length > 0) {
      console.log(`  Members: ${team.members.join(', ')}`);
    }
  });
}

main();

