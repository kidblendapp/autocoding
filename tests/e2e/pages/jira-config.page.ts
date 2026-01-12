import { Page, expect } from '@playwright/test';

/**
 * Page Object Model for JIRA Configuration page
 */
export class JiraConfigPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/');
    // Wait for the page to load - adjust selector based on your actual UI
    await this.page.waitForLoadState('networkidle');
  }

  async fillJiraPath(path: string) {
    await this.page.getByLabel('JIRA Path').fill(path);
  }

  async fillJiraEmail(email: string) {
    await this.page.getByLabel('JIRA Email').fill(email);
  }

  async fillJiraApiToken(token: string) {
    // Token field might be password type, so we use getByLabel
    await this.page.getByLabel('JIRA API Token').fill(token);
  }

  async fillProjectName(projectName: string) {
    await this.page.getByLabel('Project Name').fill(projectName);
  }

  async saveConfig() {
    await this.page.getByRole('button', { name: 'Save Configuration' }).click();
  }

  async reloadConfig() {
    await this.page.getByRole('button', { name: 'Reload' }).click();
  }

  async getSuccessMessage(): Promise<string | null> {
    const alert = this.page.getByRole('alert');
    if (await alert.count() > 0) {
      return await alert.textContent();
    }
    return null;
  }

  async getErrorMessage(): Promise<string | null> {
    const alert = this.page.getByRole('alert');
    if (await alert.count() > 0) {
      const severity = await alert.getAttribute('aria-label');
      if (severity?.includes('error') || await alert.locator('[class*="error"]').count() > 0) {
        return await alert.textContent();
      }
    }
    return null;
  }

  async toggleTokenVisibility() {
    await this.page.getByRole('button', { name: /Show|Hide/ }).click();
  }

  async isTokenVisible(): Promise<boolean> {
    const tokenField = this.page.getByLabel('JIRA API Token');
    const inputType = await tokenField.getAttribute('type');
    return inputType === 'text';
  }

  async waitForLoading() {
    // Wait for loading spinner to disappear
    await this.page.waitForSelector('[role="progressbar"]', { state: 'hidden' }).catch(() => {
      // Loading might not be present, which is fine
    });
  }
}
