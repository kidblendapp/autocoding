import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { configApi } from '../services/api';
import type { JiraConfig } from '../types/config';

export default function JiraConfig() {
  const [config, setConfig] = useState<JiraConfig>({
    jiraPath: '',
    jiraEmail: '',
    jiraApiToken: '',
    projectName: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await configApi.loadJiraConfig();
      // If token is hidden, keep existing token if available, otherwise leave empty
      if (data.jiraApiToken === '***hidden***') {
        setConfig(prev => ({
          ...data,
          jiraApiToken: prev.jiraApiToken || '',
        }));
      } else {
        setConfig(data);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        let errorMessage = 'Failed to load config';
        
        if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
          errorMessage = 'Cannot connect to server. Make sure the backend server is running on port 3001.';
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        setMessage({ type: 'error', text: errorMessage });
        console.error('Error loading JIRA config:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await configApi.saveJiraConfig(config);
      setMessage({ type: 'success', text: 'JIRA configuration saved successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save config' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof JiraConfig) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
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
        JIRA Configuration
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="JIRA Path"
          value={config.jiraPath}
          onChange={handleChange('jiraPath')}
          placeholder="https://your-instance.atlassian.net"
          fullWidth
          required
        />
        <TextField
          label="JIRA Email"
          type="email"
          value={config.jiraEmail}
          onChange={handleChange('jiraEmail')}
          placeholder="your-email@example.com"
          fullWidth
          required
        />
        <Box>
          <TextField
            label="JIRA API Token"
            type={showToken ? 'text' : 'password'}
            value={config.jiraApiToken}
            onChange={handleChange('jiraApiToken')}
            placeholder="Enter your API token"
            fullWidth
            required
          />
          <Button
            size="small"
            onClick={() => setShowToken(!showToken)}
            sx={{ mt: 1 }}
          >
            {showToken ? 'Hide' : 'Show'} Token
          </Button>
        </Box>
        <TextField
          label="Project Name"
          value={config.projectName}
          onChange={handleChange('projectName')}
          placeholder="PROJECT"
          fullWidth
          required
        />
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            onClick={saveConfig}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Save Configuration'}
          </Button>
          <Button variant="outlined" onClick={loadConfig} disabled={loading}>
            Reload
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
