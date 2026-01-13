import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { workflowApi, jiraApi, storiesApi, scheduleApi } from '../services/api';

interface WorkflowStatus {
  extracted: boolean;
  decomposed: boolean;
  scheduleGenerated: boolean;
  extractedPath: string;
  decomposedPath: string;
  schedulePath: string;
}

export default function WorkflowOperations() {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const result = await workflowApi.getStatus();
      setStatus(result.status);
    } catch (error: any) {
      console.error('Failed to load workflow status:', error);
    }
  };

  const handleExtract = async () => {
    setExtracting(true);
    setMessage(null);
    try {
      const result = await jiraApi.extractTickets({ includeHistory: false });
      setMessage({ type: 'success', text: result.message || `Successfully extracted ${result.ticketCount} tickets` });
      await loadStatus();
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to extract tickets' 
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleDecompose = async () => {
    setDecomposing(true);
    setMessage(null);
    try {
      // Check if extraction is needed
      if (!status?.extracted) {
        setMessage({ type: 'info', text: 'Extraction required. Running extraction first...' });
        await handleExtract();
      }

      const result = await storiesApi.decomposeStories({
        inputFile: 'outputs/jira-export.csv',
        hoursPerStoryPoint: 8,
      });
      setMessage({ 
        type: 'success', 
        text: result.message || `Successfully processed ${result.totalStories} stories` 
      });
      await loadStatus();
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to decompose stories' 
      });
    } finally {
      setDecomposing(false);
    }
  };

  const handleGenerateSchedule = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      // Check if extraction is needed (schedule generation uses extracted CSV)
      if (!status?.extracted) {
        setMessage({ type: 'info', text: 'Extraction required. Running extraction first...' });
        await handleExtract();
      }

      const result = await scheduleApi.generateSchedule({
        inputFile: 'outputs/jira-export.csv',
      });
      setMessage({ 
        type: 'success', 
        text: result.message || 'Schedule generated successfully' 
      });
      await loadStatus();
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to generate schedule' 
      });
    } finally {
      setGenerating(false);
    }
  };

  const steps = [
    {
      label: 'Extract All Tickets',
      description: 'Extract all tickets from JIRA using JQL query from configuration',
      status: status?.extracted ? 'completed' : 'pending',
      action: handleExtract,
      loading: extracting,
      outputPath: status?.extractedPath,
    },
    {
      label: 'Decompose and Estimate',
      description: 'Decompose stories and generate team estimates',
      status: status?.decomposed ? 'completed' : status?.extracted ? 'ready' : 'pending',
      action: handleDecompose,
      loading: decomposing,
      outputPath: status?.decomposedPath,
    },
    {
      label: 'Generate Schedule',
      description: 'Generate team schedule with dates from extracted tickets',
      status: status?.scheduleGenerated ? 'completed' : status?.extracted ? 'ready' : 'pending',
      action: handleGenerateSchedule,
      loading: generating,
      outputPath: status?.schedulePath,
    },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Workflow Operations
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Run the workflow steps in order. Each step will automatically run previous steps if needed.
      </Typography>

      {message && (
        <Alert 
          severity={message.type} 
          sx={{ mb: 3 }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <Stepper orientation="vertical">
        {steps.map((step, index) => (
          <Step key={index} active={step.status !== 'pending'} completed={step.status === 'completed'}>
            <StepLabel
              icon={
                step.status === 'completed' ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <RadioButtonUncheckedIcon />
                )
              }
            >
              <Typography variant="h6">{step.label}</Typography>
            </StepLabel>
            <StepContent>
              <Card variant="outlined" sx={{ mt: 1, mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {step.description}
                  </Typography>
                  
                  {step.outputPath && step.status === 'completed' && (
                    <Chip 
                      label={`Output: ${step.outputPath}`} 
                      size="small" 
                      color="success" 
                      sx={{ mb: 2 }}
                    />
                  )}

                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button
                      variant="contained"
                      onClick={step.action}
                      disabled={step.loading || (step.status === 'pending' && index > 0 && steps[index - 1].status !== 'completed')}
                      startIcon={step.loading ? <CircularProgress size={16} /> : null}
                    >
                      {step.loading 
                        ? 'Running...' 
                        : step.status === 'completed' 
                          ? 'Run Again' 
                          : 'Run Step'
                      }
                    </Button>
                    {step.status === 'pending' && index > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Previous step required
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button variant="outlined" onClick={loadStatus} disabled={loading}>
          Refresh Status
        </Button>
      </Box>
    </Paper>
  );
}
