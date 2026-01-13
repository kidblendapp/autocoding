import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { configApi } from '../services/api';
import type { ScheduleConfig } from '../types/config';

export default function WorkTypesConfig() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newWorkTypeId, setNewWorkTypeId] = useState('');
  const [newWorkTypeName, setNewWorkTypeName] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

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
      setMessage({ type: 'success', text: 'Work types configuration saved successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save config' });
    } finally {
      setSaving(false);
    }
  };

  const addWorkType = () => {
    if (!config || !newWorkTypeId.trim() || !newWorkTypeName.trim()) return;
    setConfig({
      ...config,
      workTypes: {
        ...(config.workTypes || {}),
        [newWorkTypeId.trim()]: { name: newWorkTypeName.trim() },
      },
    });
    setNewWorkTypeId('');
    setNewWorkTypeName('');
  };

  const removeWorkType = (workTypeId: string) => {
    if (!config) return;
    const { [workTypeId]: removed, ...remaining } = config.workTypes || {};
    setConfig({ ...config, workTypes: remaining });
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
        Work Types Configuration
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Work Type ID"
            value={newWorkTypeId}
            onChange={(e) => setNewWorkTypeId(e.target.value)}
            placeholder="PSME-FE"
            size="small"
          />
          <TextField
            label="Work Type Name"
            value={newWorkTypeName}
            onChange={(e) => setNewWorkTypeName(e.target.value)}
            placeholder="PSME-FE"
            size="small"
            fullWidth
          />
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addWorkType}
            disabled={!newWorkTypeId.trim() || !newWorkTypeName.trim()}
          >
            Add
          </Button>
        </Box>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(config.workTypes || {}).map(([id, workType]) => (
              <TableRow key={id}>
                <TableCell>{id}</TableCell>
                <TableCell>{workType.name}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeWorkType(id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {(!config.workTypes || Object.keys(config.workTypes).length === 0) && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  No work types configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
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
