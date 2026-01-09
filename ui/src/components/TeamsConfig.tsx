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
  IconButton,
  Chip,
  Stack,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { configApi } from '../services/api';
import type { ScheduleConfig, TeamConfig, ExtractedValues } from '../types/config';

export default function TeamsConfig() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [extractedValues, setExtractedValues] = useState<ExtractedValues>({});

  useEffect(() => {
    loadConfig();
    loadExtractedValues();
  }, []);

  const loadExtractedValues = async () => {
    try {
      const values = await configApi.loadExtractedValues();
      setExtractedValues(values);
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
      setMessage({ type: 'success', text: 'Teams configuration saved successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save config' });
    } finally {
      setSaving(false);
    }
  };

  const addTeam = () => {
    if (!config) return;
    const newTeamId = `team-${Date.now()}`;
    const newTeam: TeamConfig = {
      name: 'New Team',
      includeInSchedule: true,
      velocity: 10,
      velocityPeriod: 'sprint',
      members: [],
      matchRules: {
        issueTypes: [],
        jiraTeam: [],
        components: [],
        labels: [],
        summaryText: [],
        statuses: [],
      },
    };
    setConfig({
      ...config,
      teams: { ...config.teams, [newTeamId]: newTeam },
    });
  };

  const removeTeam = (teamId: string) => {
    if (!config) return;
    const { [teamId]: removed, ...remainingTeams } = config.teams;
    setConfig({ ...config, teams: remainingTeams });
  };

  const updateTeam = (teamId: string, field: keyof TeamConfig, value: any) => {
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

  const updateMatchRule = (teamId: string, rule: string, value: string[]) => {
    if (!config) return;
    setConfig({
      ...config,
      teams: {
        ...config.teams,
        [teamId]: {
          ...config.teams[teamId],
          matchRules: {
            ...config.teams[teamId].matchRules,
            [rule]: value,
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Teams Configuration</Typography>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={addTeam}>
          Add Team
        </Button>
      </Box>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(config.teams || {}).map(([teamId, team]) => (
          <Accordion key={teamId}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 2 }}>
                <Typography>{team.name || teamId}</Typography>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTeam(teamId);
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
                  label="Team Name"
                  value={team.name}
                  onChange={(e) => updateTeam(teamId, 'name', e.target.value)}
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
                <TextField
                  label="Velocity"
                  type="number"
                  value={team.velocity}
                  onChange={(e) => updateTeam(teamId, 'velocity', parseFloat(e.target.value) || 0)}
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel>Velocity Period</InputLabel>
                  <Select
                    value={team.velocityPeriod}
                    onChange={(e) => updateTeam(teamId, 'velocityPeriod', e.target.value)}
                    label="Velocity Period"
                  >
                    <MenuItem value="sprint">Sprint</MenuItem>
                    <MenuItem value="day">Day</MenuItem>
                    <MenuItem value="week">Week</MenuItem>
                  </Select>
                </FormControl>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Members
                  </Typography>
                  <ArrayField
                    items={team.members}
                    onAdd={(item) => updateTeam(teamId, 'members', [...team.members, item])}
                    onRemove={(index) => updateTeam(teamId, 'members', team.members.filter((_, i) => i !== index))}
                    placeholder="Add member"
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Match Rules
                  </Typography>
                  <MatchRulesEditor
                    extractedValues={extractedValues}
                    rules={team.matchRules}
                    onUpdate={(rule, value) => updateMatchRule(teamId, rule, value)}
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

function ArrayField({ items, onAdd, onRemove, placeholder, options }: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  options?: string[];
}) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      onAdd(newItem.trim());
      setNewItem('');
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
        {items.map((item, index) => (
          <Chip
            key={index}
            label={item}
            onDelete={() => onRemove(index)}
            size="small"
          />
        ))}
      </Stack>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          select={options !== undefined}
          SelectProps={options !== undefined ? { native: true } : undefined}
          fullWidth
        >
          {options !== undefined ? (
            <>
              <option value="">{options.length > 0 ? 'Select or type' : 'No options available - extract values first'}</option>
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </>
          ) : null}
        </TextField>
        <Button size="small" variant="outlined" onClick={handleAdd}>
          Add
        </Button>
      </Box>
    </Box>
  );
}

function MatchRulesEditor({ rules, onUpdate, extractedValues }: {
  rules: TeamConfig['matchRules'];
  onUpdate: (rule: string, value: string[]) => void;
  extractedValues: ExtractedValues;
}) {
  const ruleFields = [
    { key: 'issueTypes', label: 'Issue Types', options: extractedValues.issueTypes || [] },
    { key: 'jiraTeam', label: 'JIRA Team', options: extractedValues.teams || [] },
    { key: 'components', label: 'Components', options: extractedValues.components || [] },
    { key: 'labels', label: 'Labels' },
    { key: 'summaryText', label: 'Summary Text' },
    { key: 'statuses', label: 'Statuses', options: extractedValues.statuses || [] },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {ruleFields.map(({ key, label, options }) => (
        <Box key={key}>
          <Typography variant="caption" display="block" gutterBottom>
            {label}
          </Typography>
          <ArrayField
            items={rules[key as keyof typeof rules] as string[]}
            onAdd={(item) => onUpdate(key, [...(rules[key as keyof typeof rules] as string[]), item])}
            onRemove={(index) => {
              const current = rules[key as keyof typeof rules] as string[];
              onUpdate(key, current.filter((_, i) => i !== index));
            }}
            placeholder={`Add ${label.toLowerCase()}`}
            options={options}
          />
        </Box>
      ))}
    </Box>
  );
}
