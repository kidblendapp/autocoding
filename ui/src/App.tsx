import React, { useState } from 'react';
import { Box, Tabs, Tab, Container, AppBar, Toolbar, Typography } from '@mui/material';
import ConfigurationTabs from './components/ConfigurationTabs';
import JiraOperations from './components/JiraOperations';
import StoryManagement from './components/StoryManagement';
import WorkflowOperations from './components/WorkflowOperations';
import GanttGenerator from './components/GanttGenerator';

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
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Schedule Configuration UI Tool
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
          <Tabs value={value} onChange={handleChange} aria-label="main tabs">
            <Tab label="Configuration" />
            <Tab label="JIRA Operations" />
            <Tab label="Story Management" />
            <Tab label="Workflow" />
            <Tab label="Gantt Charts" />
          </Tabs>
        </Box>
        <TabPanel value={value} index={0}>
          <ConfigurationTabs />
        </TabPanel>
        <TabPanel value={value} index={1}>
          <JiraOperations />
        </TabPanel>
        <TabPanel value={value} index={2}>
          <StoryManagement />
        </TabPanel>
        <TabPanel value={value} index={3}>
          <WorkflowOperations />
        </TabPanel>
        <TabPanel value={value} index={4}>
          <GanttGenerator />
        </TabPanel>
      </Container>
    </Box>
  );
}

export default App;
