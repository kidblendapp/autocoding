/**
 * Test fixtures for JIRA configuration
 */

export interface JiraConfigFixture {
  jiraPath: string;
  jiraEmail: string;
  jiraApiToken: string;
  projectName: string;
}

export const validJiraConfig: JiraConfigFixture = {
  jiraPath: 'https://test.atlassian.net',
  jiraEmail: 'test@example.com',
  jiraApiToken: 'test-token-123',
  projectName: 'TEST',
};

export const invalidJiraConfig = {
  jiraPath: '',  // missing required field
  jiraEmail: 'test@example.com',
  jiraApiToken: 'test-token-123',
  projectName: 'TEST',
};

export const partialJiraConfig = {
  jiraPath: 'https://test.atlassian.net',
  jiraEmail: 'test@example.com',
  // missing jiraApiToken and projectName
};

export const jiraConfigWithBOM = '\uFEFF' + JSON.stringify(validJiraConfig);
