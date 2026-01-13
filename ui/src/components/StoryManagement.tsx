import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  TextField,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { storiesApi } from '../services/api';
import TeamEstimateConfig from './TeamEstimateConfig';
import DependencyGraph, { type Dependency } from './DependencyGraph';

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
      id={`story-tabpanel-${index}`}
      aria-labelledby={`story-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export default function StoryManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [decomposing, setDecomposing] = useState(false);
  const [inputFile, setInputFile] = useState('outputs/jira-export.csv');
  const [hoursPerStoryPoint, setHoursPerStoryPoint] = useState(8);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dependencies, setDependencies] = useState<Record<string, Dependency[]>>({});
  const [allDependencies, setAllDependencies] = useState<Dependency[]>([]);

  useEffect(() => {
    loadDependencies();
  }, []);

  const loadDependencies = async () => {
    try {
      const data = await storiesApi.getAllDependencies();
      setDependencies(data.dependencies || {});
      // Flatten dependencies
      const flat: Dependency[] = [];
      Object.entries(data.dependencies || {}).forEach(([key, deps]: [string, any]) => {
        deps.forEach((dep: any) => {
          flat.push({
            source: dep.source || key,
            target: dep.target,
            type: dep.type || 'blocks',
          });
        });
      });
      setAllDependencies(flat);
    } catch (error: any) {
      // Ignore if file doesn't exist
      if (error.response?.status !== 404) {
        console.error('Failed to load dependencies:', error);
      }
    }
  };

  const handleDecompose = async () => {
    setDecomposing(true);
    setError(null);
    setResult(null);
    try {
      const result = await storiesApi.decomposeStories({
        inputFile,
        hoursPerStoryPoint,
      });
      setResult(result);
      // Reload dependencies after decomposition
      await loadDependencies();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to decompose stories');
    } finally {
      setDecomposing(false);
    }
  };

  const handleDependenciesChange = async (storyKey: string, newDeps: Dependency[]) => {
    try {
      await storiesApi.updateDependencies(storyKey, newDeps);
      const updatedDeps = { ...dependencies, [storyKey]: newDeps };
      setDependencies(updatedDeps);
      // Update all dependencies list
      const allFlat: Dependency[] = [];
      Object.entries(updatedDeps).forEach(([key, deps]) => {
        deps.forEach((dep: any) => {
          allFlat.push({
            source: dep.source || key,
            target: dep.target,
            type: dep.type || 'blocks',
          });
        });
      });
      setAllDependencies(allFlat);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update dependencies');
    }
  };

  const stories = result?.results?.map((r: any) => ({
    key: r.storyKey,
    summary: r.storySummary || (r.storyEstimate ? `Estimate: ${r.storyEstimate.hours}h` : 'No estimate'),
  })) || [];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          Story Management
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="CSV Input File"
            value={inputFile}
            onChange={(e) => setInputFile(e.target.value)}
            placeholder="outputs/jira-export.csv"
            fullWidth
          />
          <TextField
            label="Hours per Story Point"
            type="number"
            value={hoursPerStoryPoint}
            onChange={(e) => setHoursPerStoryPoint(parseFloat(e.target.value) || 8)}
            fullWidth
            inputProps={{ min: 1, step: 0.5 }}
          />
          <Button
            variant="contained"
            onClick={handleDecompose}
            disabled={decomposing || !inputFile.trim()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {decomposing ? <CircularProgress size={20} /> : 'Decompose Stories'}
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Alert severity="success">
              {result.message} - {result.successfulStories} of {result.totalStories} stories processed successfully
            </Alert>
          )}
        </Box>
      </Paper>

      {result && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Team Configuration" />
            <Tab label="Story Estimates" />
            <Tab label="Dependencies" />
          </Tabs>
        </Box>
      )}

      <TabPanel value={tabValue} index={0}>
        <TeamEstimateConfig />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {result && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Story Key</TableCell>
                  <TableCell>Case</TableCell>
                  <TableCell>Story Estimate</TableCell>
                  <TableCell>Team Estimates</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.results?.map((r: any) => (
                  <TableRow key={r.storyKey}>
                    <TableCell>{r.storyKey}</TableCell>
                    <TableCell>
                      <Chip label={r.case} size="small" />
                    </TableCell>
                    <TableCell>
                      {r.storyEstimate
                        ? `${r.storyEstimate.hours}h (${r.storyEstimate.storyPoints} SP)`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {r.teamEstimates?.map((te: any, idx: number) => (
                          <Typography key={idx} variant="caption">
                            {te.teamId}: {te.estimate.toFixed(2)}h
                          </Typography>
                        ))}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {result && stories.length > 0 && (
          <DependencyGraph
            stories={stories}
            dependencies={allDependencies}
            onDependenciesChange={async (newDeps) => {
              setAllDependencies(newDeps);
              // Group by source story
              const grouped: Record<string, Dependency[]> = {};
              newDeps.forEach((dep) => {
                if (!grouped[dep.source]) {
                  grouped[dep.source] = [];
                }
                grouped[dep.source].push(dep);
              });
              // Also check for stories that might have had dependencies removed
              // (stories that are in current dependencies but not in newDeps)
              const currentSourceKeys = new Set(newDeps.map(d => d.source));
              Object.keys(dependencies).forEach(key => {
                if (!currentSourceKeys.has(key)) {
                  // Story has no dependencies anymore
                  grouped[key] = [];
                }
              });
              // Save each story's dependencies
              await Promise.all(
                Object.entries(grouped).map(([key, deps]) => 
                  handleDependenciesChange(key, deps)
                )
              );
            }}
          />
        )}
      </TabPanel>
    </Box>
  );
}
