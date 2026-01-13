import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import JiraConfig from './JiraConfig';
import ProjectSettings from './ProjectSettings';
import TeamsConfig from './TeamsConfig';
import WorkTypesConfig from './WorkTypesConfig';
import WorkTypeSequences from './WorkTypeSequences';
import FieldMappingConfig from './FieldMappingConfig';

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
      id={`config-tabpanel-${index}`}
      aria-labelledby={`config-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export default function ConfigurationTabs() {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={value} onChange={handleChange} aria-label="configuration tabs">
          <Tab label="JIRA Configuration" />
          <Tab label="Project Settings" />
          <Tab label="Teams" />
          <Tab label="Work Types" />
          <Tab label="Work Sequences" />
          <Tab label="Field Mapping" />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        <JiraConfig />
      </TabPanel>
      <TabPanel value={value} index={1}>
        <ProjectSettings />
      </TabPanel>
      <TabPanel value={value} index={2}>
        <TeamsConfig />
      </TabPanel>
      <TabPanel value={value} index={3}>
        <WorkTypesConfig />
      </TabPanel>
      <TabPanel value={value} index={4}>
        <WorkTypeSequences />
      </TabPanel>
      <TabPanel value={value} index={5}>
        <FieldMappingConfig />
      </TabPanel>
    </Box>
  );
}
