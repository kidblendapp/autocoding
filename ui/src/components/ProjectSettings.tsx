import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  ListItemText,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
} from '@mui/material';
import { configApi, jiraApi } from '../services/api';
import type { ScheduleConfig, ExtractedValues } from '../types/config';

export default function ProjectSettings() {
  const [config, setConfig] = useState<Partial<ScheduleConfig>>({
    projectStartDate: '',
    sprintDurationDays: 10,
    planningIssueTypes: [],
    planningFixVersions: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newPlanningIssueType, setNewPlanningIssueType] = useState('');
  const [newPlanningFixVersion, setNewPlanningFixVersion] = useState('');
  const [jql, setJql] = useState('');
  const [predecessorLinkTypes, setPredecessorLinkTypes] = useState<string[]>([]);
  const [estimateType, setEstimateType] = useState<'storyPoints' | 'hours'>('storyPoints');
  const [nonWorkingDays, setNonWorkingDays] = useState<string[]>([]);
  const [newNonWorkingDay, setNewNonWorkingDay] = useState('');
  const [extractingAll, setExtractingAll] = useState(false);
  const [extractedValues, setExtractedValues] = useState<ExtractedValues>({});
  const DEFAULT_LINK_TYPES = ['Blocks', 'blocks', 'Successors', 'successors', 'Has to be done before'];

  useEffect(() => {
    loadConfig();
    loadExtractedValues();
  }, []);

  const loadExtractedValues = async () => {
    try {
      const values = await configApi.loadExtractedValues();
      setExtractedValues(values);
      
      // Auto-select default link types if they exist and no link types are currently selected
      if (values.linkTypes && predecessorLinkTypes.length === 0) {
        const defaultsToSelect = DEFAULT_LINK_TYPES.filter(lt => 
          values.linkTypes?.includes(lt)
        );
        if (defaultsToSelect.length > 0) {
          setPredecessorLinkTypes(defaultsToSelect);
        }
      }
    } catch (error: any) {
      // Ignore if file doesn't exist
      if (error.response?.status !== 404) {
        console.error('Failed to load extracted values:', error);
      }
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await configApi.loadScheduleConfig();
      setConfig(data);
      setJql((data as any).jql || '');
      setPredecessorLinkTypes((data as any).predecessorLinkTypes || []);
      setEstimateType((data as any).estimateType || 'storyPoints');
      setNonWorkingDays((data as any).nonWorkingDays || []);
      
    } catch (error: any) {
      if (error.response?.status !== 404) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load config' });
      }
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Load full config first, then update and save
      const fullConfig = await configApi.loadScheduleConfig();
      const updatedConfig = { 
        ...fullConfig, 
        ...config, 
        jql, 
        predecessorLinkTypes,
        estimateType,
        nonWorkingDays
      };
      await configApi.saveScheduleConfig(updatedConfig);
      setMessage({ type: 'success', text: 'Project settings saved successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save config' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ScheduleConfig) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    if (field === 'sprintDurationDays') {
      setConfig(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
    } else {
      setConfig(prev => ({ ...prev, [field]: value }));
    }
  };

  const addPlanningIssueType = () => {
    if (newPlanningIssueType.trim()) {
      setConfig(prev => ({
        ...prev,
        planningIssueTypes: [...(prev.planningIssueTypes || []), newPlanningIssueType.trim()],
      }));
      setNewPlanningIssueType('');
    }
  };

  const removePlanningIssueType = (index: number) => {
    setConfig(prev => ({
      ...prev,
      planningIssueTypes: prev.planningIssueTypes?.filter((_, i) => i !== index) || [],
    }));
  };

  const addPlanningFixVersion = () => {
    if (newPlanningFixVersion.trim()) {
      setConfig(prev => ({
        ...prev,
        planningFixVersions: [...(prev.planningFixVersions || []), newPlanningFixVersion.trim()],
      }));
      setNewPlanningFixVersion('');
    }
  };

  const removePlanningFixVersion = (index: number) => {
    setConfig(prev => ({
      ...prev,
      planningFixVersions: prev.planningFixVersions?.filter((_, i) => i !== index) || [],
    }));
  };

  const extractAllFields = async () => {
    setExtractingAll(true);
    setMessage(null);
    try {
      // First save current JQL if changed
      if (jql !== (config as any).jql) {
        const fullConfig = await configApi.loadScheduleConfig();
        await configApi.saveScheduleConfig({ ...fullConfig, jql });
      }
      
      // Extract all fields
      const result = await jiraApi.extractAllFields();
      setExtractedValues(result);
      
      // Auto-select default link types if they exist and no link types are currently selected
      if (result.linkTypes && predecessorLinkTypes.length === 0) {
        const defaultsToSelect = DEFAULT_LINK_TYPES.filter(lt => 
          result.linkTypes?.includes(lt)
        );
        if (defaultsToSelect.length > 0) {
          setPredecessorLinkTypes(defaultsToSelect);
        }
      }
      
      // Reload extracted values to ensure UI is updated
      await loadExtractedValues();
      
      setMessage({ type: 'success', text: 'All field values extracted successfully' });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to extract field values';
      setMessage({ type: 'error', text: errorMessage });
      console.error('Error extracting all fields:', error);
    } finally {
      setExtractingAll(false);
    }
  };

  const addNonWorkingDay = () => {
    if (newNonWorkingDay.trim()) {
      // Support comma-separated dates and date ranges
      const dates = newNonWorkingDay.split(',').map(d => d.trim()).filter(Boolean);
      const newDates: string[] = [];
      
      dates.forEach(dateStr => {
        // Check if it's a date range (format: YYYY-MM-DD:YYYY-MM-DD)
        if (dateStr.includes(':')) {
          const [start, end] = dateStr.split(':').map(d => d.trim());
          if (start && end) {
            // Expand date range
            const startDate = new Date(start);
            const endDate = new Date(end);
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              const current = new Date(startDate);
              while (current <= endDate) {
                newDates.push(current.toISOString().split('T')[0]);
                current.setDate(current.getDate() + 1);
              }
            }
      }
        } else {
          // Single date
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            newDates.push(dateStr);
          }
        }
      });
      
      if (newDates.length > 0) {
        setNonWorkingDays([...nonWorkingDays, ...newDates.filter(d => !nonWorkingDays.includes(d))]);
        setNewNonWorkingDay('');
      }
    }
  };

  const removeNonWorkingDay = (index: number) => {
    setNonWorkingDays(nonWorkingDays.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Project Settings
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Project Start Date"
          type="date"
          value={config.projectStartDate || ''}
          onChange={handleChange('projectStartDate')}
          InputLabelProps={{ shrink: true }}
          fullWidth
          required
        />
        <TextField
          label="Project Rescheduling Date (Optional)"
          type="date"
          value={config.projectReschedulingDate || ''}
          onChange={handleChange('projectReschedulingDate')}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
        <TextField
          label="Sprint Duration (Days)"
          type="number"
          value={config.sprintDurationDays || 10}
          onChange={handleChange('sprintDurationDays')}
          fullWidth
          required
          inputProps={{ min: 1 }}
        />
        <TextField
          label="JQL Query (Optional)"
          value={jql}
          onChange={(e) => setJql(e.target.value)}
          placeholder="project = PROJECT AND issueType = Story"
          fullWidth
          multiline
          rows={3}
          helperText="Custom JQL query to limit extracted tickets"
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={extractAllFields}
            disabled={extractingAll}
            sx={{ minWidth: 200 }}
          >
            {extractingAll ? <CircularProgress size={20} /> : 'Extract All Values'}
          </Button>
        </Box>
        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Planning Settings
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            These settings are used for decomposition and schedule generation operations. 
            They filter the extracted tickets during planning, not during JIRA extraction.
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Planning Issue Types
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
              {config.planningIssueTypes?.map((type, index) => (
                <Chip
                  key={index}
                  label={type}
                  onDelete={() => removePlanningIssueType(index)}
                  size="small"
                />
              ))}
            </Stack>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Add planning issue type"
                value={newPlanningIssueType}
                onChange={(e) => setNewPlanningIssueType(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPlanningIssueType())}
                select
                SelectProps={{
                  native: true,
                }}
                sx={{ minWidth: 200 }}
              >
                <option value="">Select or type</option>
                {(extractedValues.issueTypes || []).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </TextField>
              <Button size="small" variant="outlined" onClick={addPlanningIssueType}>
                Add
              </Button>
            </Box>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Planning Fix Versions
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
              {config.planningFixVersions?.map((version, index) => (
                <Chip
                  key={index}
                  label={version}
                  onDelete={() => removePlanningFixVersion(index)}
                  size="small"
                />
              ))}
            </Stack>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Add planning fix version"
                value={newPlanningFixVersion}
                onChange={(e) => setNewPlanningFixVersion(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPlanningFixVersion())}
                select
                SelectProps={{
                  native: true,
                }}
                sx={{ minWidth: 200 }}
              >
                <option value="">Select or type</option>
                {(extractedValues.fixVersions || []).map((version) => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </TextField>
              <Button size="small" variant="outlined" onClick={addPlanningFixVersion}>
                Add
              </Button>
            </Box>
          </Box>
        </Box>
        <FormControl fullWidth>
          <InputLabel>Predecessor Link Types</InputLabel>
          <Select
            multiple
            value={predecessorLinkTypes}
            onChange={(e) => setPredecessorLinkTypes(e.target.value as string[])}
            label="Predecessor Link Types"
            renderValue={(selected) => (selected as string[]).join(', ')}
          >
            {extractedValues.linkTypes?.map((type) => (
              <MenuItem key={type} value={type}>
                <Checkbox checked={predecessorLinkTypes.indexOf(type) > -1} />
                <ListItemText primary={type} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl component="fieldset">
          <FormLabel component="legend">Estimate Type</FormLabel>
          <RadioGroup
            row
            value={estimateType}
            onChange={(e) => setEstimateType(e.target.value as 'storyPoints' | 'hours')}
          >
            <FormControlLabel value="storyPoints" control={<Radio />} label="Story Points" />
            <FormControlLabel value="hours" control={<Radio />} label="Hours (Original/Remaining Estimate)" />
          </RadioGroup>
        </FormControl>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Non-Working Days
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
            {nonWorkingDays.map((date, index) => (
              <Chip
                key={index}
                label={date}
                onDelete={() => removeNonWorkingDay(index)}
                size="small"
              />
            ))}
          </Stack>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="YYYY-MM-DD or YYYY-MM-DD:YYYY-MM-DD or comma-separated"
              value={newNonWorkingDay}
              onChange={(e) => setNewNonWorkingDay(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addNonWorkingDay())}
              fullWidth
              helperText="Enter dates in YYYY-MM-DD format, ranges as YYYY-MM-DD:YYYY-MM-DD, or comma-separated"
            />
            <Button size="small" variant="outlined" onClick={addNonWorkingDay}>
              Add
            </Button>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            onClick={saveConfig}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Save Settings'}
          </Button>
          <Button variant="outlined" onClick={loadConfig} disabled={loading}>
            Reload
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
