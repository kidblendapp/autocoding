import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { configApi } from '../services/api';
import type { JiraConfig, CustomFieldMapping } from '../types/config';

interface FieldMappingRow {
  fieldName: string;
  fieldId: string;
  displayName: string;
  description: string;
}

const FIELD_DEFINITIONS: FieldMappingRow[] = [
  {
    fieldName: 'team',
    fieldId: 'customfield_10001',
    displayName: 'Team',
    description: 'Custom field for team assignment (e.g., PSME-FE, PSME-BE)',
  },
  {
    fieldName: 'storyPoints',
    fieldId: 'customfield_10052',
    displayName: 'Story Points',
    description: 'Custom field for story points estimation',
  },
  {
    fieldName: 'originalEstimate',
    fieldId: 'customfield_10410',
    displayName: 'Original Estimate',
    description: 'Custom field for original time estimate (numeric value)',
  },
  {
    fieldName: 'epicLink',
    fieldId: 'customfield_10008',
    displayName: 'Epic Link',
    description: 'Custom field linking ticket to parent epic',
  },
  {
    fieldName: 'sprint',
    fieldId: 'customfield_10010',
    displayName: 'Sprint',
    description: 'Custom field for sprint assignment',
  },
  {
    fieldName: 'dateField',
    fieldId: 'customfield_10098',
    displayName: 'Date Field',
    description: 'Custom date field',
  },
  {
    fieldName: 'dateTimeField',
    fieldId: 'customfield_10012',
    displayName: 'DateTime Field',
    description: 'Custom date-time field',
  },
];

const FIELD_ID_PATTERN = /^customfield_\d+$/;

export default function FieldMappingConfig() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [fieldNames, setFieldNames] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const config = await configApi.loadJiraConfig();
      const mappings: Record<string, string> = {};
      const names: Record<string, string> = {};

      // Initialize with defaults from FIELD_DEFINITIONS
      FIELD_DEFINITIONS.forEach((def) => {
        mappings[def.fieldName] = config.customFieldMapping?.[def.fieldName as keyof CustomFieldMapping] || def.fieldId;
        const fieldId = mappings[def.fieldName];
        names[fieldId] = config.customFieldNames?.[fieldId] || def.displayName;
      });

      setFieldMappings(mappings);
      setFieldNames(names);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load config' });
      } else {
        // Initialize with defaults if config doesn't exist
        const mappings: Record<string, string> = {};
        const names: Record<string, string> = {};
        FIELD_DEFINITIONS.forEach((def) => {
          mappings[def.fieldName] = def.fieldId;
          names[def.fieldId] = def.displayName;
        });
        setFieldMappings(mappings);
        setFieldNames(names);
      }
    } finally {
      setLoading(false);
    }
  };

  const validateFieldId = (fieldId: string): string | null => {
    if (!fieldId.trim()) {
      return 'Field ID is required';
    }
    if (!FIELD_ID_PATTERN.test(fieldId)) {
      return 'Field ID must match pattern: customfield_XXXXX (e.g., customfield_10001)';
    }
    return null;
  };

  const handleFieldIdChange = (fieldName: string, value: string) => {
    const error = validateFieldId(value);
    setErrors((prev) => ({
      ...prev,
      [fieldName]: error || '',
    }));

    if (!error) {
      setFieldMappings((prev) => ({
        ...prev,
        [fieldName]: value,
      }));

      // Update display name key if field ID changed
      const oldFieldId = FIELD_DEFINITIONS.find((d) => d.fieldName === fieldName)?.fieldId;
      if (oldFieldId && oldFieldId !== value) {
        const oldDisplayName = fieldNames[oldFieldId];
        setFieldNames((prev) => {
          const newNames = { ...prev };
          if (oldDisplayName && oldDisplayName !== oldFieldId) {
            // Keep the display name for the new field ID
            newNames[value] = oldDisplayName;
            delete newNames[oldFieldId];
          } else {
            // Use default display name
            const def = FIELD_DEFINITIONS.find((d) => d.fieldName === fieldName);
            if (def) {
              newNames[value] = def.displayName;
            }
            delete newNames[oldFieldId];
          }
          return newNames;
        });
      }
    }
  };

  const handleDisplayNameChange = (fieldId: string, value: string) => {
    setFieldNames((prev) => ({
      ...prev,
      [fieldId]: value || fieldId,
    }));
  };

  const handleSave = async () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};
    Object.entries(fieldMappings).forEach(([fieldName, fieldId]) => {
      const error = validateFieldId(fieldId);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setMessage({ type: 'error', text: 'Please fix validation errors before saving' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const config = await configApi.loadJiraConfig();
      
      // Build customFieldMapping object
      const customFieldMapping: CustomFieldMapping = {};
      Object.entries(fieldMappings).forEach(([fieldName, fieldId]) => {
        customFieldMapping[fieldName as keyof CustomFieldMapping] = fieldId;
      });

      await configApi.saveJiraConfig({
        ...config,
        customFieldMapping,
        customFieldNames: fieldNames,
      });

      setMessage({ type: 'success', text: 'Field mapping saved successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save field mapping' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Custom Field Mapping</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadConfig}
            disabled={loading || saving}
          >
            Reload
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </Box>
      </Box>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        Configure custom field IDs for JIRA fields used in estimation, planning, and scheduling.
        Field IDs must follow the pattern: <code>customfield_XXXXX</code> where XXXXX is a number.
      </Alert>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Field Name</TableCell>
              <TableCell>Custom Field ID</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {FIELD_DEFINITIONS.map((def) => {
              const fieldId = fieldMappings[def.fieldName] || def.fieldId;
              const displayName = fieldNames[fieldId] || def.displayName;
              const error = errors[def.fieldName];

              return (
                <TableRow key={def.fieldName}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {def.displayName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={fieldMappings[def.fieldName] || ''}
                      onChange={(e) => handleFieldIdChange(def.fieldName, e.target.value)}
                      error={!!error}
                      helperText={error}
                      placeholder="customfield_XXXXX"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={displayName}
                      onChange={(e) => handleDisplayNameChange(fieldId, e.target.value)}
                      placeholder={def.displayName}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {def.description}
                      </Typography>
                      <Tooltip title={def.description}>
                        <HelpIcon fontSize="small" color="action" />
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
