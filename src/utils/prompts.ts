/**
 * Interactive prompt utilities for CLI commands.
 * Uses Node.js built-in readline module.
 */

import * as readline from 'readline';

/**
 * Creates a readline interface for user input.
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompts user for input with a question.
 * 
 * @param question - Question to ask the user
 * @returns Promise that resolves to user's input
 */
export function prompt(question: string): Promise<string> {
  const rl = createReadlineInterface();
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts user for input with a question (for passwords/tokens).
 * Note: Input will be visible. For hidden input, consider using environment variables.
 * 
 * @param question - Question to ask the user
 * @returns Promise that resolves to user's input
 */
export function promptPassword(question: string): Promise<string> {
  // For simplicity and cross-platform compatibility, use regular prompt
  // In production, consider using environment variables or a library like 'readline-sync'
  console.warn('⚠️  Note: API token input will be visible. Consider using --config file or environment variables for security.');
  return prompt(question);
}

/**
 * Prompts user for JIRA configuration when config is not provided.
 * 
 * @returns Promise that resolves to JIRA configuration object
 */
export async function promptJiraConfig(): Promise<{
  jiraPath: string;
  jiraEmail: string;
  jiraApiToken: string;
  projectName: string;
}> {
  console.log('\n📋 JIRA Configuration Required\n');
  
  const jiraPath = await prompt('JIRA Base URL (e.g., https://yourcompany.atlassian.net): ');
  if (!jiraPath) {
    throw new Error('JIRA Base URL is required');
  }
  
  const jiraEmail = await prompt('JIRA Email: ');
  if (!jiraEmail) {
    throw new Error('JIRA Email is required');
  }
  
  const jiraApiToken = await promptPassword('JIRA API Token: ');
  if (!jiraApiToken) {
    throw new Error('JIRA API Token is required');
  }
  
  const projectName = await prompt('Project Name (e.g., AP): ');
  if (!projectName) {
    throw new Error('Project Name is required');
  }
  
  return {
    jiraPath: jiraPath.trim(),
    jiraEmail: jiraEmail.trim(),
    jiraApiToken: jiraApiToken.trim(),
    projectName: projectName.trim(),
  };
}

