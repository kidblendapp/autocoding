import { test, expect } from '@playwright/test';
import { ScheduleConfigPage } from './pages/schedule-config.page';

test.describe('Schedule Configuration E2E Tests', () => {
  let scheduleConfigPage: ScheduleConfigPage;

  test.beforeEach(async ({ page }) => {
    scheduleConfigPage = new ScheduleConfigPage(page);
    await scheduleConfigPage.navigate();
  });

  test('should load schedule configuration form', async ({ page }) => {
    // Check if form elements are present
    // Adjust selectors based on actual UI
    const form = page.locator('form');
    await expect(form).toBeVisible();
  });

  test('should save valid schedule configuration', async ({ page }) => {
    await scheduleConfigPage.fillProjectStartDate('2024-02-01');
    await scheduleConfigPage.fillSprintDurationDays(10);
    
    await scheduleConfigPage.saveConfig();
    
    // Wait for response
    await page.waitForTimeout(1000);
    
    // Should not show error
    const errorMessage = await scheduleConfigPage.getErrorMessage();
    expect(errorMessage).toBeFalsy();
  });
});
