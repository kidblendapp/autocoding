/**
 * Test fixtures for schedule configuration
 */

export interface ScheduleConfigFixture {
  projectStartDate: string;
  sprintDurationDays: number;
  velocity?: number;
  nonWorkingDays?: string[];
  jql?: string;
}

export const validScheduleConfig: ScheduleConfigFixture = {
  projectStartDate: '2024-02-01',
  sprintDurationDays: 10,
  velocity: 20,
  nonWorkingDays: ['2024-12-25', '2024-12-26'],
  jql: 'project = TEST',
};

export const minimalScheduleConfig: ScheduleConfigFixture = {
  projectStartDate: '2024-02-01',
  sprintDurationDays: 10,
};

export const invalidScheduleConfig = {
  projectStartDate: '',  // missing required field
  sprintDurationDays: 10,
};

export const scheduleConfigWithInvalidDate = {
  projectStartDate: 'invalid-date',
  sprintDurationDays: 10,
};

export const scheduleConfigWithZeroSprintDuration = {
  projectStartDate: '2024-02-01',
  sprintDurationDays: 0,  // invalid
};
