# Team Estimate Configuration Guide

## Overview

The team estimate configuration system supports three distinct scenarios for generating team-specific estimates from user stories:

1. **Case 1: Story-Level Estimate Only** - All work is estimated at the story level, team estimates are derived using coefficients
2. **Case 2: Hybrid** - Part of work is estimated at story level, part is decomposed into subtasks with estimates
3. **Case 3: Subtasks Only** - All work is estimated in subtasks, story has no estimate

## Configuration Structure

### Presets

Presets provide predefined coefficient sets for common team structures. Use presets to quickly configure standard scenarios.

```json
{
  "presets": {
    "standard-agile": {
      "name": "Standard Agile Team",
      "teamCoefficients": {
        "BA": { "method": "percentage", "value": 0.25 },
        "Dev": { "method": "percentage", "value": 0.50 },
        "QA": { "method": "percentage", "value": 0.25 }
      }
    }
  }
}
```

**Available Presets:**
- `standard-agile`: BA (25%), Dev (50%), QA (25%)
- `hours-per-point`: Fixed hours per story point (BA: 2h/SP, Dev: 4h/SP, QA: 2h/SP)
- `multi-team`: Multiple dev teams with shared BA/QA

### Teams

Define teams involved in story execution:

```json
{
  "teams": {
    "team-ba": {
      "id": "team-ba",
      "name": "BA Team",
      "type": "BA",
      "velocity": 30,
      "defaultCoefficient": {
        "method": "percentage",
        "value": 0.25
      }
    }
  }
}
```

**Team Properties:**
- `id`: Unique team identifier
- `name`: Display name
- `type`: Team type (BA, Dev, QA, etc.)
- `velocity`: Team velocity (story points per sprint)
- `defaultCoefficient`: Default coefficient for estimate derivation

### Estimation Rules

#### Case 1: Story-Level Estimate Only

When a story has an estimate but no subtasks (or subtasks without estimates), use coefficients to derive team estimates.

```json
{
  "estimationRules": {
    "case1_storyOnly": {
      "calculationMethod": "coefficients",
      "teamCoefficients": {
        "BA": { "method": "percentage", "value": 0.25 },
        "Dev": { "method": "percentage", "value": 0.50 },
        "QA": { "method": "percentage", "value": 0.25 }
      }
    }
  }
}
```

**Calculation:**
- `teamEstimate = storyEstimate × coefficient`

**Coefficient Methods:**
- `percentage`: Value between 0.0 and 1.0 (e.g., 0.25 = 25%)
- `hoursPerPoint`: Hours per story point (e.g., 2.0 = 2 hours per SP)

#### Case 2: Hybrid (Story + Subtasks)

When a story has both a story-level estimate and subtasks with estimates, combine both sources.

```json
{
  "estimationRules": {
    "case2_hybrid": {
      "calculationMethod": "hybrid",
      "subtaskMatching": {
        "BA": {
          "matchCriteria": {
            "labels": ["BA", "Analysis"],
            "summaryTags": ["[BA]"]
          },
          "fallbackToCoefficient": true,
          "fallbackCoefficient": { "method": "percentage", "value": 0.25 }
        }
      },
      "storyEstimateUsage": {
        "applyToTeamsWithoutSubtasks": true,
        "applyAsValidation": false
      }
    }
  }
}
```

**Calculation Logic:**
1. Match subtasks to teams using `matchCriteria`
2. Sum subtask estimates (in hours) for each team
3. For teams without matching subtasks: Use story estimate × coefficient
4. Optionally validate subtask sum against story estimate

**Subtask Matching Criteria:**
- `components`: Match by component name
- `labels`: Match by label
- `summaryTags`: Match by summary tag pattern (e.g., "[BA]", "[FE]")
- `issueTypes`: Match by issue type

#### Case 3: Subtasks Only

When all work is estimated in subtasks and story has no estimate:

```json
{
  "estimationRules": {
    "case3_subtasksOnly": {
      "calculationMethod": "subtasks",
      "subtaskMatching": {
        "BA": {
          "matchCriteria": {
            "labels": ["BA"],
            "summaryTags": ["[BA]"]
          }
        }
      },
      "missingEstimateHandling": {
        "defaultValue": 0,
        "warnOnMissing": true,
        "skipSubtask": false
      }
    }
  }
}
```

**Calculation:**
- `teamEstimate = SUM(matchingSubtaskEstimates)`

**Missing Estimate Handling:**
- `defaultValue`: Value to use when subtask estimate is missing
- `warnOnMissing`: Whether to log a warning
- `skipSubtask`: Whether to exclude subtask from calculation

### Task Sequencing

Define execution order and parallelism for tasks:

```json
{
  "taskSequencing": {
    "defaultMode": "sequential",
    "executionModes": {
      "sequential": {
        "name": "Sequential Execution",
        "parallelism": 1
      },
      "parallel": {
        "name": "Parallel Execution",
        "parallelism": "unlimited"
      }
    },
    "workTypeSequences": {
      "PSME-FE": {
        "executionOrder": [
          {
            "role": "BA",
            "teamId": "team-ba",
            "dependencies": [],
            "canRunInParallel": false
          },
          {
            "role": "Dev",
            "teamId": "team-fe",
            "dependencies": ["BA"],
            "canRunInParallel": true
          }
        ]
      }
    }
  }
}
```

**Execution Modes:**
- `sequential`: Tasks execute one after another
- `parallel`: Tasks can execute simultaneously
- `limitedParallel`: Limited number of parallel tasks

**Dependencies:**
- `dependencies`: List of roles/tasks that must complete first
- `canRunInParallel`: Whether this task can run parallel with others

## Usage Examples

### Example 1: Story with 8 Story Points, No Subtasks

**Input:**
- Story estimate: 8 SP
- Subtasks: None

**Configuration:** Case 1 (coefficients)
- BA: 25% = 2 SP = 16 hours (assuming 8h/SP)
- Dev: 50% = 4 SP = 32 hours
- QA: 25% = 2 SP = 16 hours

**Output:**
```json
{
  "BA": { "storyPoints": 2, "hours": 16 },
  "Dev": { "storyPoints": 4, "hours": 32 },
  "QA": { "storyPoints": 2, "hours": 16 }
}
```

### Example 2: Story with 5 SP + Subtasks

**Input:**
- Story estimate: 5 SP
- Subtasks:
  - "[BA] Analysis" - 4h
  - "[FE] UI Implementation" - 16h
  - "[QA] Testing" - 8h

**Configuration:** Case 2 (hybrid)
- BA: Subtask sum = 4h (no fallback needed)
- Dev: Subtask sum = 16h (no fallback needed)
- QA: Subtask sum = 8h (no fallback needed)

**Output:**
```json
{
  "BA": { "hours": 4 },
  "Dev": { "hours": 16 },
  "QA": { "hours": 8 }
}
```

### Example 3: Story with Only Subtasks

**Input:**
- Story estimate: None
- Subtasks:
  - "[BA] Requirements" - 8h
  - "[BE] API Development" - 24h
  - "[FE] Frontend" - 16h
  - "[QA] Testing" - 12h

**Configuration:** Case 3 (subtasks only)
- BA: 8h
- Dev: 40h (BE: 24h + FE: 16h)
- QA: 12h

**Output:**
```json
{
  "BA": { "hours": 8 },
  "Dev": { "hours": 40 },
  "QA": { "hours": 12 }
}
```

## UI Integration

The configuration is designed to be UI-friendly:

1. **Presets**: Dropdown to select predefined coefficient sets
2. **Team Coefficients**: Editable table with method and value
3. **Subtask Matching**: Visual rule builder for matching criteria
4. **Sequencing**: Drag-and-drop interface for execution order
5. **Validation**: Real-time validation with error messages

### UI Settings

```json
{
  "uiSettings": {
    "presetsVisible": true,
    "allowCustomCoefficients": true,
    "validation": {
      "validateCoefficientSum": true,
      "coefficientSumTolerance": 0.05
    }
  }
}
```

## Best Practices

1. **Use Presets**: Start with predefined presets and customize as needed
2. **Validate Coefficients**: Ensure coefficient sums are reasonable (typically 0.8-1.2)
3. **Clear Matching Rules**: Use consistent naming conventions for subtask matching
4. **Document Custom Rules**: Add descriptions to custom configurations
5. **Test All Cases**: Verify configuration works for all three estimation cases

## Migration from Existing Config

The new configuration extends the existing `schedule_config.json`:

- Existing `teams` configuration is compatible
- Existing `workTypeSequences` can be migrated to `taskSequencing.workTypeSequences`
- New estimation rules are additive and don't break existing functionality

## See Also

- [Epic Description](./epic-team-estimate-generation.md)
- [Technical Requirements](./solution/technical-requirements.md)
- [Schedule Calculation](./solution/subsystems/schedule-calculation.md)
