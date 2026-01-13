import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography as MuiTypography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { jiraApi } from '../services/api';

export default function JiraOperations() {
  const [extracting, setExtracting] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [extractResult, setExtractResult] = useState<any>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  
  const [inspecting, setInspecting] = useState(false);
  const [ticketKey, setTicketKey] = useState('');
  const [ticketData, setTicketData] = useState<any>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const handleExtract = async () => {
    setExtracting(true);
    setExtractError(null);
    setExtractResult(null);
    try {
      const result = await jiraApi.extractTickets({ includeHistory });
      setExtractResult(result);
    } catch (error: any) {
      setExtractError(error.response?.data?.message || 'Failed to extract tickets');
    } finally {
      setExtracting(false);
    }
  };

  const handleInspect = async () => {
    if (!ticketKey.trim()) return;
    setInspecting(true);
    setInspectError(null);
    setTicketData(null);
    try {
      const result = await jiraApi.inspectTicket(ticketKey.trim());
      setTicketData(result);
    } catch (error: any) {
      setInspectError(error.response?.data?.message || 'Failed to inspect ticket');
    } finally {
      setInspecting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Extract All Tickets
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeHistory}
                onChange={(e) => setIncludeHistory(e.target.checked)}
              />
            }
            label="Include Change History (Status, Sprint, Original Estimate, Story Points)"
          />
          <Button
            variant="contained"
            onClick={handleExtract}
            disabled={extracting}
            sx={{ alignSelf: 'flex-start' }}
          >
            {extracting ? <CircularProgress size={20} /> : 'Extract Tickets'}
          </Button>
          {extractError && (
            <Alert severity="error">{extractError}</Alert>
          )}
          {extractResult && (
            <Alert severity="success">
              Successfully extracted {extractResult.ticketCount} tickets
            </Alert>
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Inspect Ticket Fields
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Ticket Key"
              value={ticketKey}
              onChange={(e) => setTicketKey(e.target.value)}
              placeholder="PROJECT-123"
              onKeyPress={(e) => e.key === 'Enter' && handleInspect()}
            />
            <Button
              variant="contained"
              onClick={handleInspect}
              disabled={inspecting || !ticketKey.trim()}
            >
              {inspecting ? <CircularProgress size={20} /> : 'Inspect'}
            </Button>
          </Box>
          {inspectError && (
            <Alert severity="error">{inspectError}</Alert>
          )}
          {ticketData && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <MuiTypography>
                  {ticketData.key}: {ticketData.summary}
                </MuiTypography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  <pre style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(ticketData.fields, null, 2)}
                  </pre>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
