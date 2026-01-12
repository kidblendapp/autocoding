import { Page } from '@playwright/test';

/**
 * Page Object Model for Schedule Configuration page
 */
export class ScheduleConfigPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async fillProjectStartDate(date: string) {
    await this.page.getByLabel('Project Start Date').fill(date);
  }

  async fillSprintDurationDays(days: number) {
    await this.page.getByLabel('Sprint Duration Days').fill(days.toString());
  }

  async saveConfig() {
    await this.page.getByRole('button', { name: /Save/i }).click();
  }

  async getSuccessMessage(): Promise<string | null> {
    const alert = this.page.getByRole('alert');
    if (await alert.count() > 0) {
      return await alert.textContent();
    }
    return null;
  }
}
