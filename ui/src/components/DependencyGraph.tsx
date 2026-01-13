import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export interface Dependency {
  source: string;
  target: string;
  type: 'blocks' | 'precedes';
}

interface DependencyGraphProps {
  stories: Array<{ key: string; summary: string }>;
  dependencies: Dependency[];
  onDependenciesChange: (dependencies: Dependency[]) => void;
}

export default function DependencyGraph({
  stories,
  dependencies,
  onDependenciesChange,
}: DependencyGraphProps) {
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [selectedType, setSelectedType] = useState<'blocks' | 'precedes'>('blocks');

  // Convert stories to nodes
  const initialNodes: Node[] = useMemo(() => {
    return stories.map((story, index) => ({
      id: story.key,
      type: 'default',
      position: {
        x: (index % 5) * 200,
        y: Math.floor(index / 5) * 150,
      },
      data: { label: `${story.key}: ${story.summary.substring(0, 30)}...` },
    }));
  }, [stories]);

  // Convert dependencies to edges
  const initialEdges: Edge[] = useMemo(() => {
    return dependencies.map((dep, index) => ({
      id: `edge-${index}`,
      source: dep.source,
      target: dep.target,
      label: dep.type,
      type: 'smoothstep',
      animated: dep.type === 'blocks',
      style: {
        stroke: dep.type === 'blocks' ? '#ff6b6b' : '#4ecdc4',
      },
    }));
  }, [dependencies]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        const newDep: Dependency = {
          source: params.source,
          target: params.target,
          type: 'blocks',
        };
        onDependenciesChange([...dependencies, newDep]);
      }
    },
    [dependencies, onDependenciesChange]
  );

  const addDependency = () => {
    if (selectedSource && selectedTarget && selectedSource !== selectedTarget) {
      // Check if dependency already exists
      const exists = dependencies.some(
        (d) => d.source === selectedSource && d.target === selectedTarget
      );
      if (!exists) {
        const newDep: Dependency = {
          source: selectedSource,
          target: selectedTarget,
          type: selectedType,
        };
        onDependenciesChange([...dependencies, newDep]);
        setSelectedSource('');
        setSelectedTarget('');
      }
    }
  };

  const removeDependency = (index: number) => {
    onDependenciesChange(dependencies.filter((_, i) => i !== index));
  };

  // Update nodes when stories change
  useEffect(() => {
    const newNodes: Node[] = stories.map((story, index) => ({
      id: story.key,
      type: 'default',
      position: {
        x: (index % 5) * 200,
        y: Math.floor(index / 5) * 150,
      },
      data: { label: `${story.key}: ${story.summary.substring(0, 30)}...` },
    }));
    setNodes(newNodes);
  }, [stories, setNodes]);

  // Update edges when dependencies change
  useEffect(() => {
    const newEdges: Edge[] = dependencies.map((dep, index) => ({
      id: `edge-${index}`,
      source: dep.source,
      target: dep.target,
      label: dep.type,
      type: 'smoothstep',
      animated: dep.type === 'blocks',
      style: {
        stroke: dep.type === 'blocks' ? '#ff6b6b' : '#4ecdc4',
      },
    }));
    setEdges(newEdges);
  }, [dependencies, setEdges]);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Dependency Graph
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Source Story</InputLabel>
          <Select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            label="Source Story"
          >
            {stories.map((story) => (
              <MenuItem key={story.key} value={story.key}>
                {story.key}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as 'blocks' | 'precedes')}
            label="Type"
          >
            <MenuItem value="blocks">Blocks</MenuItem>
            <MenuItem value="precedes">Precedes</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Target Story</InputLabel>
          <Select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            label="Target Story"
          >
            {stories.map((story) => (
              <MenuItem key={story.key} value={story.key}>
                {story.key}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" onClick={addDependency}>
          Add Dependency
        </Button>
      </Box>
      <Box sx={{ height: 500, border: '1px solid #ddd', borderRadius: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </Box>
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Dependencies List
        </Typography>
        {dependencies.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No dependencies defined
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {dependencies.map((dep, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">
                  {dep.source} <strong>{dep.type}</strong> {dep.target}
                </Typography>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeDependency(index)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
