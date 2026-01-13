import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import { ganttApi, configApi } from '../services/api';
import type { ScheduleConfig, GroupingLevel } from '../types/config';
import GanttGroupingConfig from './GanttGroupingConfig';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`gantt-tabpanel-${index}`}
      aria-labelledby={`gantt-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function GanttGenerator() {
  const [tabValue, setTabValue] = useState(0);
  const [inputFile, setInputFile] = useState('outputs/jira-team-schedule.csv');
  const [outputFile, setOutputFile] = useState('outputs/gantt-chart.html');
  const [ganttGroupingLevels, setGanttGroupingLevels] = useState<GroupingLevel[]>(['epic', 'sprint']);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [generatingHtml, setGeneratingHtml] = useState(false);
  const [excelResult, setExcelResult] = useState<any>(null);
  const [htmlResult, setHtmlResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const config = await configApi.loadScheduleConfig();
      if (config.ganttGroupingLevels) {
        setGanttGroupingLevels(config.ganttGroupingLevels);
      } else if (config.ganttGrouping) {
        // Migrate old format to new format
        const mapping: Record<string, GroupingLevel[]> = {
          'epicSprint': ['epic', 'sprint'],
          'sprintTeam': ['sprint', 'team'],
          'sprintEpic': ['sprint', 'epic'],
          'epicTeam': ['epic', 'team'],
          'teamSprint': ['team', 'sprint'],
          'teamEpic': ['team', 'epic'],
        };
        const levels = mapping[config.ganttGrouping] || ['epic', 'sprint'];
        setGanttGroupingLevels(levels);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load config' });
      }
    } finally {
      setLoading(false);
    }
  };

  const saveGanttGrouping = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const config = await configApi.loadScheduleConfig();
      await configApi.saveScheduleConfig({
        ...config,
        ganttGroupingLevels: ganttGroupingLevels
      });
      setMessage({ type: 'success', text: 'Gantt grouping saved successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save Gantt grouping' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateExcel = async () => {
    setGeneratingExcel(true);
    setError(null);
    setExcelResult(null);
    try {
      const result = await ganttApi.generateExcelGantt({ inputFile });
      setExcelResult(result);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to generate Excel Gantt');
    } finally {
      setGeneratingExcel(false);
    }
  };

  const handleGenerateHtml = async () => {
    setGeneratingHtml(true);
    setError(null);
    setHtmlResult(null);
    try {
      const result = await ganttApi.generateHtmlGantt({ 
        inputFile, 
        outputFile,
        groupingLevels: ganttGroupingLevels
      });
      setHtmlResult(result);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to generate HTML Gantt');
    } finally {
      setGeneratingHtml(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Gantt Chart Generation
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Generate" />
          <Tab label="Preview" />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {message && (
            <Alert severity={message.type} onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}
          <GanttGroupingConfig
            value={ganttGroupingLevels}
            onChange={setGanttGroupingLevels}
            maxLevels={4}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={saveGanttGrouping}
              disabled={saving || loading}
            >
              {saving ? <CircularProgress size={20} /> : 'Save Grouping'}
            </Button>
            <Button variant="outlined" onClick={loadConfig} disabled={loading}>
              Reload
            </Button>
          </Box>
          <TextField
            label="Input CSV File"
            value={inputFile}
            onChange={(e) => setInputFile(e.target.value)}
            placeholder="outputs/jira-team-schedule.csv"
            fullWidth
          />
          <TextField
            label="Output HTML File (for HTML generation)"
            value={outputFile}
            onChange={(e) => setOutputFile(e.target.value)}
            placeholder="outputs/gantt-chart.html"
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleGenerateExcel}
              disabled={generatingExcel || !inputFile.trim()}
            >
              {generatingExcel ? <CircularProgress size={20} /> : 'Generate Excel'}
            </Button>
            <Button
              variant="contained"
              onClick={handleGenerateHtml}
              disabled={generatingHtml || !inputFile.trim()}
            >
              {generatingHtml ? <CircularProgress size={20} /> : 'Generate HTML'}
            </Button>
          </Box>
          {error && (
            <Alert severity="error">{error}</Alert>
          )}
          {excelResult && (
            <Alert severity="success">
              {excelResult.message}
              {excelResult.filePath && (
                <Box component="div" sx={{ mt: 1 }}>
                  File: {excelResult.filePath}
                </Box>
              )}
            </Alert>
          )}
          {htmlResult && (
            <Alert severity="success">
              {htmlResult.message}
              {htmlResult.filePath && (
                <Box component="div" sx={{ mt: 1 }}>
                  File: {htmlResult.filePath}
                </Box>
              )}
            </Alert>
          )}
        </Box>
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <Alert severity="info">
          Gantt preview functionality is under development.
        </Alert>
      </TabPanel>
    </Paper>
  );
}
