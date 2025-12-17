/**
 * Test pagination with startAt
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

async function testPagination() {
  const config = loadJiraConfig('jira-config.json');
  const baseUrl = config.jiraPath.replace(/\/$/, '');
  const apiUrl = `${baseUrl}/rest/api/3/search/jql`;
  const authHeader = createAuthHeader(config.jiraEmail, config.jiraApiToken);
  const jql = `project = ${config.projectName} ORDER BY key ASC`;
  
  // Test page 2 with startAt = 100
  console.log('Test: Fetching page 2 (startAt = 100)');
  const requestBody = {
    jql: jql,
    maxResults: 100,
    startAt: 100,
    fields: ['key', 'summary'],
  };
  
  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log(`✅ Success! Found ${data.issues?.length || 0} tickets on page 2`);
      console.log(`Total: ${data.total || 'unknown'}`);
      if (data.issues && data.issues.length > 0) {
        console.log('First ticket on page 2:', data.issues[0].key);
        console.log('Last ticket on page 2:', data.issues[data.issues.length - 1].key);
      }
    } else {
      console.log('Response:', text.substring(0, 500));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testPagination();

