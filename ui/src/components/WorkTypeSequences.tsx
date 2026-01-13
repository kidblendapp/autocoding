import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { configApi } from '../services/api';
import type { ScheduleConfig, WorkTypeSequence } from '../types/config';

export default function WorkTypeSequences() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedWorkType, setSelectedWorkType] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await configApi.loadScheduleConfig();
      setConfig(data);
      if (data.workTypes && Object.keys(data.workTypes).length > 0) {
        setSelectedWorkType(Object.keys(data.workTypes)[0]);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load config' });
      }
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      await configApi.saveScheduleConfig(config);
      setMessage({ type: 'success', text: 'Work type sequences saved successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save config' });
    } finally {
      setSaving(false);
    }
  };

  const addSequence = () => {
    if (!config || !selectedWorkType) return;
    const newSequence: WorkTypeSequence = {
      role: 'Dev',
      estimateMethod: 'percentage',
      percentage: 1.0,
      statuses: [],
      executionTeam: '',
    };
    setConfig({
      ...config,
      workTypeSequences: {
        ...(config.workTypeSequences || {}),
        [selectedWorkType]: [
          ...(config.workTypeSequences?.[selectedWorkType] || []),
          newSequence,
        ],
      },
    });
  };

  const removeSequence = (workType: string, index: number) => {
    if (!config) return;
    const sequences = config.workTypeSequences?.[workType] || [];
    setConfig({
      ...config,
      workTypeSequences: {
        ...config.workTypeSequences,
        [workType]: sequences.filter((_, i) => i !== index),
      },
    });
  };

  const updateSequence = (workType: string, index: number, field: keyof WorkTypeSequence, value: any) => {
    if (!config) return;
    const sequences = config.workTypeSequences?.[workType] || [];
    const updated = [...sequences];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({
      ...config,
      workTypeSequences: {
        ...config.workTypeSequences,
        [workType]: updated,
      },
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (!config) {
    return <Alert severity="warning">No configuration loaded</Alert>;
  }

  const workTypes = Object.keys(config.workTypes || {});
  const sequences = selectedWorkType ? (config.workTypeSequences?.[selectedWorkType] || []) : [];
  const teams = Object.keys(config.teams || {});

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Work Type Sequences
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Work Type</InputLabel>
          <Select
            value={selectedWorkType}
            onChange={(e) => setSelectedWorkType(e.target.value)}
            label="Work Type"
          >
            {workTypes.map((wt) => (
              <MenuItem key={wt} value={wt}>
                {wt} - {config.workTypes?.[wt].name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {selectedWorkType && (
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addSequence}
            sx={{ mb: 2 }}
          >
            Add Sequence Step
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sequences.map((sequence, index) => (
          <Accordion key={index}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                <Typography>
                  {sequence.role} - {sequence.estimateMethod === 'percentage' 
                    ? `${(sequence.percentage || 0) * 100}%` 
                    : 'Subtasks'}
                </Typography>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSequence(selectedWorkType, index);
                  }}
                  size="small"
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Role"
                  value={sequence.role}
                  onChange={(e) => updateSequence(selectedWorkType, index, 'role', e.target.value)}
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel>Estimate Method</InputLabel>
                  <Select
                    value={sequence.estimateMethod}
                    onChange={(e) => updateSequence(selectedWorkType, index, 'estimateMethod', e.target.value)}
                    label="Estimate Method"
                  >
                    <MenuItem value="percentage">Percentage</MenuItem>
                    <MenuItem value="subtasks">Subtasks</MenuItem>
                  </Select>
                </FormControl>
                {sequence.estimateMethod === 'percentage' && (
                  <TextField
                    label="Percentage"
                    type="number"
                    value={sequence.percentage || 0}
                    onChange={(e) => updateSequence(selectedWorkType, index, 'percentage', parseFloat(e.target.value) || 0)}
                    fullWidth
                    inputProps={{ min: 0, max: 1, step: 0.01 }}
                  />
                )}
                <FormControl fullWidth>
                  <InputLabel>Execution Team</InputLabel>
                  <Select
                    value={sequence.executionTeam}
                    onChange={(e) => updateSequence(selectedWorkType, index, 'executionTeam', e.target.value)}
                    label="Execution Team"
                  >
                    {teams.map((teamId) => (
                      <MenuItem key={teamId} value={config.teams?.[teamId].name || teamId}>
                        {config.teams?.[teamId].name || teamId}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Statuses
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                    {sequence.statuses.map((status, statusIndex) => (
                      <Chip
                        key={statusIndex}
                        label={status}
                        onDelete={() => {
                          const updated = sequence.statuses.filter((_, i) => i !== statusIndex);
                          updateSequence(selectedWorkType, index, 'statuses', updated);
                        }}
                        size="small"
                      />
                    ))}
                  </Stack>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Add status"
                      onKeyPress={(e: any) => {
                        if (e.key === 'Enter') {
                          const value = e.target.value.trim();
                          if (value) {
                            updateSequence(selectedWorkType, index, 'statuses', [...sequence.statuses, value]);
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
        {sequences.length === 0 && selectedWorkType && (
          <Alert severity="info">No sequences configured for this work type</Alert>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="contained" onClick={saveConfig} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : 'Save Configuration'}
        </Button>
        <Button variant="outlined" onClick={loadConfig} disabled={loading}>
          Reload
        </Button>
      </Box>
    </Paper>
  );
}
