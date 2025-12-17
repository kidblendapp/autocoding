/**
 * Script to inspect all fields from a JIRA ticket
 */

import { existsSync, readFileSync } from 'fs';

interface JiraConfig {
  jiraPath: string;
  jiraEmail: string;
  jiraApiToken: string;
  projectName: string;
}

function loadJiraConfig(configPath: string): JiraConfig {
  const configContent = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configContent);
  return config;
}

function createAuthHeader(email: string, apiToken: string): string {
  const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
  return `Basic ${credentials}`;
}

async function inspectTicket() {
  const config = loadJiraConfig('jira-config.json');
  const baseUrl = config.jiraPath.replace(/\/$/, '');
  const ticketKey = 'PSME-2777';
  const apiUrl = `${baseUrl}/rest/api/3/issue/${ticketKey}`;
  const authHeader = createAuthHeader(config.jiraEmail, config.jiraApiToken);
  
  console.log(`Fetching all fields for ticket ${ticketKey}...\n`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const data = await response.json();
    
    console.log('=== ALL FIELDS ===\n');
    console.log(JSON.stringify(data.fields, null, 2));
    
    console.log('\n=== FIELD NAMES ===\n');
    const fieldNames = Object.keys(data.fields || {});
    fieldNames.forEach((field, index) => {
      const value = data.fields[field];
      let valueStr = '';
      if (value === null || value === undefined) {
        valueStr = 'null';
      } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
          valueStr = `[${value.length} items]`;
        } else {
          valueStr = JSON.stringify(value).substring(0, 100);
        }
      } else {
        valueStr = String(value).substring(0, 100);
      }
      console.log(`${index + 1}. ${field}: ${valueStr}`);
    });
    
    // Write full response to file for reference
    const fs = require('fs');
    fs.writeFileSync('outputs/psme-160-fields.json', JSON.stringify(data, null, 2));
    console.log(`\n✅ Full ticket data saved to outputs/psme-160-fields.json (replaced with ${ticketKey} data)`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

inspectTicket();

