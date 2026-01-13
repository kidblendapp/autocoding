/**
 * API service layer for communicating with the Express backend
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Config API
export const configApi = {
  loadScheduleConfig: async () => {
    const response = await api.get('/config/schedule');
    return response.data;
  },
  
  saveScheduleConfig: async (config: any) => {
    const response = await api.put('/config/schedule', config);
    return response.data;
  },
  
  loadJiraConfig: async () => {
    const response = await api.get('/config/jira');
    return response.data;
  },
  
  saveJiraConfig: async (config: any) => {
    const response = await api.put('/config/jira', config);
    return response.data;
  },
  
  validateConfig: async () => {
    const response = await api.get('/config/validate');
    return response.data;
  },
  
  loadTeamEstimateConfig: async () => {
    const response = await api.get('/config/team-estimate');
    return response.data;
  },
  
  saveTeamEstimateConfig: async (config: any) => {
    const response = await api.put('/config/team-estimate', config);
    return response.data;
  },
  
  loadExtractedValues: async () => {
    const response = await api.get('/config/extracted-values');
    return response.data;
  },
  
  saveExtractedValues: async (values: any) => {
    const response = await api.put('/config/extracted-values', values);
    return response.data;
  },
  
  clearExtractedValues: async () => {
    const response = await api.delete('/config/extracted-values');
    return response.data;
  },
};

// JIRA API
export const jiraApi = {
  extractTickets: async (options: { includeHistory?: boolean }) => {
    const response = await api.post('/jira/extract', options);
    return response.data;
  },
  
  inspectTicket: async (key: string) => {
    const response = await api.get(`/jira/ticket/${key}`);
    return response.data;
  },
  
  getTicketFields: async (key: string) => {
    const response = await api.get(`/jira/ticket/${key}/fields`);
    return response.data;
  },
  
  extractFieldValues: async (field: 'issueTypes' | 'fixVersions' | 'linkTypes') => {
    const response = await api.get(`/jira/field-values/${field}`);
    return response.data.values || [];
  },
  
  extractAllFields: async () => {
    const response = await api.post('/jira/extract-all-fields');
    return response.data;
  },
};

// Stories API
export const storiesApi = {
  decomposeStories: async (input: { inputFile: string; hoursPerStoryPoint?: number }) => {
    const response = await api.post('/stories/decompose', input);
    return response.data;
  },
  
  getAllDependencies: async () => {
    const response = await api.get('/stories/dependencies');
    return response.data;
  },
  
  getDependencies: async (key: string) => {
    const response = await api.get(`/stories/${key}/dependencies`);
    return response.data;
  },
  
  updateDependencies: async (key: string, dependencies: any) => {
    const response = await api.post('/stories/dependencies', {
      storyKey: key,
      dependencies,
    });
    return response.data;
  },
};

// Schedule API
export const scheduleApi = {
  generateSchedule: async (input: { inputFile?: string }) => {
    const response = await api.post('/schedule/generate', input);
    return response.data;
  },
};

// Workflow API
export const workflowApi = {
  getStatus: async () => {
    const response = await api.get('/workflow/status');
    return response.data;
  },
};

// Gantt API
export const ganttApi = {
  generateExcelGantt: async (input: { inputFile?: string }) => {
    const response = await api.post('/gantt/excel', input);
    return response.data;
  },
  
  generateHtmlGantt: async (input: { inputFile?: string; outputFile?: string; groupingLevels?: string[] }) => {
    const response = await api.post('/gantt/html', input);
    return response.data;
  },
  
  previewGantt: async (inputFile?: string) => {
    const response = await api.get('/gantt/preview', {
      params: { inputFile },
    });
    return response.data;
  },
};

export default api;
