import { test as base } from '@playwright/test';
import { JiraConfigPage } from '../pages/jira-config.page';

type TestFixtures = {
  jiraConfigPage: JiraConfigPage;
};

export const test = base.extend<TestFixtures>({
  jiraConfigPage: async ({ page }, use) => {
    const jiraConfigPage = new JiraConfigPage(page);
    await use(jiraConfigPage);
  },
});

export { expect } from '@playwright/test';
