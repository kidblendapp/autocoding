/**
 * Test script to debug JIRA search API format
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

async function testSearch() {
  const config = loadJiraConfig('jira-config.json');
  const baseUrl = config.jiraPath.replace(/\/$/, '');
  const apiUrl = `${baseUrl}/rest/api/3/search/jql`;
  const authHeader = createAuthHeader(config.jiraEmail, config.jiraApiToken);
  const jql = `project = ${config.projectName} ORDER BY key ASC`;
  
  // Test with minimal fields first
  console.log('Test 1: Minimal fields');
  const test1 = {
    jql: jql,
    maxResults: 10,
    fields: ['key', 'summary'],
  };
  
  console.log('Request body:', JSON.stringify(test1, null, 2));
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(test1),
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log(`✅ Success! Found ${data.total || 0} tickets`);
      if (data.issues && data.issues.length > 0) {
        console.log('Sample ticket:', data.issues[0].key);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Test with more fields
  console.log('\nTest 2: Extended fields');
  const test2 = {
    jql: jql,
    maxResults: 10,
    startAt: 0,
    fields: [
      'key',
      'summary',
      'description',
      'issuetype',
      'status',
      'assignee',
      'components',
      'parent',
      'timeoriginalestimate',
      'customfield_10021',
      'customfield_10014',
    ],
  };
  
  console.log('Request body:', JSON.stringify(test2, null, 2));
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(test2),
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log(`✅ Success! Found ${data.total || 0} tickets`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testSearch();

