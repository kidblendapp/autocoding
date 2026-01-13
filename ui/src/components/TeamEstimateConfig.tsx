import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { configApi } from '../services/api';

export default function TeamEstimateConfig() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await configApi.loadTeamEstimateConfig();
      setConfig(data);
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
      await configApi.saveTeamEstimateConfig(config);
      setMessage({ type: 'success', text: 'Team estimate configuration saved successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save config' });
    } finally {
      setSaving(false);
    }
  };

  const updateTeam = (teamId: string, field: string, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      teams: {
        ...config.teams,
        [teamId]: {
          ...config.teams[teamId],
          [field]: value,
        },
      },
    });
  };

  const updateCoefficient = (teamId: string, field: 'method' | 'value', value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      teams: {
        ...config.teams,
        [teamId]: {
          ...config.teams[teamId],
          defaultCoefficient: {
            ...config.teams[teamId].defaultCoefficient,
            [field]: value,
          },
        },
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

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Team Estimate Configuration
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(config.teams || {}).map(([teamId, team]: [string, any]) => (
          <Accordion key={teamId}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{team.name || teamId}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Team ID"
                  value={team.id || teamId}
                  onChange={(e) => updateTeam(teamId, 'id', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Team Name"
                  value={team.name}
                  onChange={(e) => updateTeam(teamId, 'name', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Team Type"
                  value={team.type}
                  onChange={(e) => updateTeam(teamId, 'type', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Velocity"
                  type="number"
                  value={team.velocity}
                  onChange={(e) => updateTeam(teamId, 'velocity', parseFloat(e.target.value) || 0)}
                  fullWidth
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={team.includeInSchedule}
                      onChange={(e) => updateTeam(teamId, 'includeInSchedule', e.target.checked)}
                    />
                  }
                  label="Include in Schedule"
                />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Default Coefficient
                  </Typography>
                  <FormControl fullWidth sx={{ mb: 1 }}>
                    <InputLabel>Method</InputLabel>
                    <Select
                      value={team.defaultCoefficient?.method || 'percentage'}
                      onChange={(e) => updateCoefficient(teamId, 'method', e.target.value)}
                      label="Method"
                    >
                      <MenuItem value="percentage">Percentage</MenuItem>
                      <MenuItem value="hoursPerPoint">Hours per Point</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="Value"
                    type="number"
                    value={team.defaultCoefficient?.value || 0}
                    onChange={(e) => updateCoefficient(teamId, 'value', parseFloat(e.target.value) || 0)}
                    fullWidth
                    inputProps={{ step: 0.01 }}
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
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
