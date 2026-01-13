import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Button,
  Chip,
  Divider,
} from '@mui/material';
import {
  DragIndicator as DragIndicatorIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { GroupingLevel } from '../types/config';

interface GanttGroupingConfigProps {
  value: GroupingLevel[];
  onChange: (levels: GroupingLevel[]) => void;
  maxLevels?: number;
}

const AVAILABLE_LEVELS: GroupingLevel[] = ['fixVersion', 'epic', 'sprint', 'team'];

const LEVEL_LABELS: Record<GroupingLevel, string> = {
  fixVersion: 'Fix Version',
  epic: 'Epic',
  sprint: 'Sprint',
  team: 'Team',
};

export default function GanttGroupingConfig({
  value,
  onChange,
  maxLevels = 4,
}: GanttGroupingConfigProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const availableLevels = AVAILABLE_LEVELS.filter(level => !value.includes(level));

  const handleAdd = (level: GroupingLevel) => {
    if (value.length < maxLevels) {
      onChange([...value, level]);
    }
  };

  const handleRemove = (index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const newValue = [...value];
    const draggedItem = newValue[draggedIndex];
    newValue.splice(draggedIndex, 1);
    newValue.splice(dropIndex, 0, draggedItem);

    onChange(newValue);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Grouping Levels ({value.length}/{maxLevels})
      </Typography>
      <Paper variant="outlined" sx={{ mb: 2 }}>
        {value.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">No grouping levels selected</Typography>
            <Typography variant="caption" color="text.secondary">
              Items will be displayed in a flat list
            </Typography>
          </Box>
        ) : (
          <List dense>
            {value.map((level, index) => (
              <React.Fragment key={`${level}-${index}`}>
                <ListItem
                  sx={{
                    bgcolor: dragOverIndex === index ? 'action.hover' : 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemove(index)}
                      aria-label="remove"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnd={handleDragEnd}
                    sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
                  >
                    <DragIndicatorIcon
                      sx={{ mr: 1, color: 'text.secondary' }}
                      fontSize="small"
                    />
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={index + 1}
                            size="small"
                            color="primary"
                            sx={{ minWidth: 32, height: 24 }}
                          />
                          <Typography variant="body2">
                            {LEVEL_LABELS[level]}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
                {index < value.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {availableLevels.length > 0 && value.length < maxLevels && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Available Levels
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {availableLevels.map((level) => (
              <Chip
                key={level}
                label={LEVEL_LABELS[level]}
                onClick={() => handleAdd(level)}
                icon={<AddIcon />}
                clickable
                variant="outlined"
                color="primary"
              />
            ))}
          </Box>
        </Box>
      )}

      {value.length >= maxLevels && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Maximum {maxLevels} levels reached
        </Typography>
      )}
    </Box>
  );
}
