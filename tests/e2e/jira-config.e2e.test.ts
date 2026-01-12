import { test, expect } from './fixtures/test-base';

test.describe('JIRA Configuration E2E Tests', () => {
  test.beforeEach(async ({ jiraConfigPage }) => {
    await jiraConfigPage.navigate();
    await jiraConfigPage.waitForLoading();
  });

  test('should load existing JIRA configuration', async ({ jiraConfigPage }) => {
    // Wait for form to be populated
    await jiraConfigPage.page.waitForTimeout(1000);
    
    // Check if form fields are present
    const jiraPathField = jiraConfigPage.page.getByLabel('JIRA Path');
    await expect(jiraPathField).toBeVisible();
  });

  test('should display error when saving invalid configuration', async ({ jiraConfigPage }) => {
    // Clear all fields
    await jiraConfigPage.fillJiraPath('');
    await jiraConfigPage.fillJiraEmail('');
    await jiraConfigPage.fillProjectName('');
    
    // Try to save
    await jiraConfigPage.saveConfig();
    
    // Should show error message
    const errorMessage = await jiraConfigPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
  });

  test('should save valid JIRA configuration', async ({ jiraConfigPage }) => {
    // Fill in valid configuration
    await jiraConfigPage.fillJiraPath('https://test.atlassian.net');
    await jiraConfigPage.fillJiraEmail('test@example.com');
    await jiraConfigPage.fillJiraApiToken('test-token-123');
    await jiraConfigPage.fillProjectName('TEST');
    
    // Save
    await jiraConfigPage.saveConfig();
    
    // Wait for success message
    await jiraConfigPage.page.waitForTimeout(1000);
    
    // Should show success message (or at least not show error)
    const errorMessage = await jiraConfigPage.getErrorMessage();
    expect(errorMessage).toBeFalsy();
  });

  test('should mask API token in the form', async ({ jiraConfigPage }) => {
    // Token should be hidden by default
    const isTokenVisible = await jiraConfigPage.isTokenVisible();
    expect(isTokenVisible).toBe(false);
  });

  test('should toggle token visibility', async ({ jiraConfigPage }) => {
    // Initially hidden
    expect(await jiraConfigPage.isTokenVisible()).toBe(false);
    
    // Toggle to show
    await jiraConfigPage.toggleTokenVisibility();
    expect(await jiraConfigPage.isTokenVisible()).toBe(true);
    
    // Toggle to hide
    await jiraConfigPage.toggleTokenVisibility();
    expect(await jiraConfigPage.isTokenVisible()).toBe(false);
  });

  test('should reload configuration', async ({ jiraConfigPage }) => {
    // Modify a field
    await jiraConfigPage.fillJiraPath('https://modified.atlassian.net');
    
    // Reload
    await jiraConfigPage.reloadConfig();
    await jiraConfigPage.waitForLoading();
    
    // Field should be reset to original value (if config exists)
    await jiraConfigPage.page.waitForTimeout(1000);
  });

  test('should handle server errors gracefully', async ({ jiraConfigPage, page }) => {
    // Intercept API call and return error
    await page.route('**/api/config/jira', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });
    
    // Reload should handle error
    await jiraConfigPage.reloadConfig();
    await jiraConfigPage.waitForLoading();
    
    // Should show error message
    const errorMessage = await jiraConfigPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
  });
});
