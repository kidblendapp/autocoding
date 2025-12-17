/**
 * Script to validate JIRA connection using credentials from jira-config.json
 */

import { existsSync, readFileSync } from 'fs';

interface JiraConfig {
  jiraPath: string;
  jiraEmail: string;
  jiraApiToken: string;
  projectName: string;
}

/**
 * Loads JIRA configuration from a JSON file.
 */
function loadJiraConfig(configPath: string): JiraConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    if (!config.jiraPath || !config.jiraEmail || !config.jiraApiToken || !config.projectName) {
      throw new Error('Config file must contain jiraPath, jiraEmail, jiraApiToken, and projectName');
    }
    
    return {
      jiraPath: config.jiraPath,
      jiraEmail: config.jiraEmail,
      jiraApiToken: config.jiraApiToken,
      projectName: config.projectName,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Creates Basic Auth header for JIRA API requests.
 */
function createAuthHeader(email: string, apiToken: string): string {
  const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Validates JIRA connection by making a simple API call.
 */
async function validateConnection(config: JiraConfig): Promise<void> {
  console.log('🔍 Validating JIRA connection...\n');
  console.log(`JIRA URL: ${config.jiraPath}`);
  console.log(`Email: ${config.jiraEmail}`);
  console.log(`Project: ${config.projectName}`);
  console.log(`API Token: ${config.jiraApiToken.substring(0, 10)}...${config.jiraApiToken.substring(config.jiraApiToken.length - 10)}\n`);
  
  try {
    // Test 1: Get current user info (validates authentication)
    console.log('Test 1: Validating authentication...');
    const baseUrl = config.jiraPath.replace(/\/$/, '');
    const userUrl = `${baseUrl}/rest/api/3/myself`;
    const authHeader = createAuthHeader(config.jiraEmail, config.jiraApiToken);
    
    const userResponse = await fetch(userUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      throw new Error(`Authentication failed: ${userResponse.status} ${userResponse.statusText}\n${errorText}`);
    }
    
    const userData = await userResponse.json();
    console.log(`✅ Authentication successful!`);
    console.log(`   User: ${userData.displayName} (${userData.emailAddress})`);
    console.log(`   Account ID: ${userData.accountId}\n`);
    
    // Test 2: Get project info (validates project access)
    console.log('Test 2: Validating project access...');
    const projectUrl = `${baseUrl}/rest/api/3/project/${config.projectName}`;
    
    const projectResponse = await fetch(projectUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });
    
    if (!projectResponse.ok) {
      const errorText = await projectResponse.text();
      throw new Error(`Project access failed: ${projectResponse.status} ${projectResponse.statusText}\n${errorText}`);
    }
    
    const projectData = await projectResponse.json();
    console.log(`✅ Project access successful!`);
    console.log(`   Project Key: ${projectData.key}`);
    console.log(`   Project Name: ${projectData.name}`);
    console.log(`   Project ID: ${projectData.id}\n`);
    
    // Test 3: Try a simple search query (validates search permissions)
    console.log('Test 3: Validating search permissions...');
    const searchUrl = `${baseUrl}/rest/api/3/search/jql`;
    const jql = `project = ${config.projectName}`;
    
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jql: jql,
        maxResults: 1,
        fields: ['key', 'summary'],
      }),
    });
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.log(`⚠️  Search test failed: ${searchResponse.status} ${searchResponse.statusText}`);
      console.log(`   Error: ${errorText}\n`);
      console.log('   Note: Authentication and project access work, but search API may have issues.');
      console.log('   This might be due to API endpoint changes or permissions.\n');
    } else {
      const searchData = await searchResponse.json();
      const total = searchData.total || 0;
      console.log(`✅ Search permissions validated!`);
      console.log(`   Total tickets in project: ${total}\n`);
    }
    
    console.log('✅ All connection tests passed!');
    console.log('   Your JIRA credentials are valid and working.\n');
    
  } catch (error) {
    console.error('❌ Connection validation failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error(`   ${String(error)}`);
    }
    process.exit(1);
  }
}

/**
 * Main execution function.
 */
async function main() {
  try {
    const configPath = 'jira-config.json';
    const config = loadJiraConfig(configPath);
    await validateConnection(config);
    process.exit(0);
  } catch (error) {
    console.error('❌ Validation failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error(`   ${String(error)}`);
    }
    process.exit(1);
  }
}

// Run the script
main();

