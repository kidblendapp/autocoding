# Schedule Calculation - Technical Requirements

## Overview

The Schedule Calculation subsystem calculates realistic start and end dates for tasks based on team velocity, sprint duration, and working days. It supports sequential task processing, fractional durations, and working days calculation with weekend and holiday exclusion.

## Architecture

### Components

1. **ScheduledTask Model** (`src/models/ScheduledTask.ts`)
   - Extends Task interface with calculated date fields
   - `calculatedStartDate`: ISO format (YYYY-MM-DD)
   - `calculatedEndDate`: ISO format (YYYY-MM-DD)
   - Preserves all original task fields

2. **Schedule Calculator** (`src/calculators/schedule-calculator.ts`)
   - `calculateDuration()`: Pure function implementing formula `(Estimate / Velocity) * SprintDuration`
   - `calculateSchedule()`: Main function processing tasks sequentially
   - First task uses project start date
   - Subsequent tasks use previous task's end date as their start date
   - Calculates duration and end date for each task
   - Preserves all original task fields

3. **Working Days Calculator** (`src/calculators/working-days-calculator.ts`)
   - `WorkingDaysCalendar` class encapsulating all working day logic
   - `isWorkingDay(date: string): boolean`: Checks if a date is a working day
   - `addWorkingDays(startDate: string, days: number): string`: Adds working days with fractional support
   - `nextWorkingDay(date: string): string`: Finds next working day from a given date
   - Handles weekends (Saturday, Sunday) and configurable holidays
   - Supports fractional durations with proper rounding up

4. **Output Generator** (`src/output/output-generator.ts`)
   - Writes scheduled tasks to `output.json` in formatted JSON
   - Preserves all original task fields
   - Includes calculated start and end dates

## Implementation Details

### Duration Calculation Formula

```
Duration = (Estimate / Velocity) * SprintDuration
```

- Duration is calculated in days
- Supports fractional durations (e.g., 3.5 days)
- Example: Estimate=5, Velocity=10, SprintDuration=7 → Duration=3.5 days

### Working Days Calculation Logic

The `addWorkingDays()` method implements:

1. Ensures start date is a working day (moves to next working day if needed)
2. For zero days, returns the working start date
3. Rounds up fractional durations using `Math.ceil()`
4. Iterates day-by-day, counting only working days
5. Skips weekends (Saturday=6, Sunday=0) and configured holidays
6. Ensures result is always a working day

### Fractional Duration Handling

- Fractional durations are preserved in calculations (e.g., 2.5 days stored as 2.5)
- Date calculations use `Math.ceil(days)` to round up
- Example: 2.5 days starting Monday → Wednesday (not Tuesday)
- Ensures result always falls on a working day

### Sequential Task Processing

- Tasks are processed in order (no parallelization in basic linear schedule)
- First task uses project start date (adjusted to working day if needed)
- Subsequent tasks use previous task's end date as their start date
- No gaps between sequential tasks
- All dates are working days

### Date Format

- All dates are in ISO format (YYYY-MM-DD)
- Calculated dates stored as `calculatedStartDate` and `calculatedEndDate`
- Date arithmetic handles month/year boundaries and leap years

## API/Interface Specifications

### ScheduledTask Interface
```typescript
interface ScheduledTask extends Task {
  calculatedStartDate: string;  // ISO format: YYYY-MM-DD
  calculatedEndDate: string;    // ISO format: YYYY-MM-DD
}
```

### Schedule Calculator Interface
```typescript
function calculateDuration(
  estimate: number,
  velocity: number,
  sprintDurationDays: number
): number

function calculateSchedule(
  tasks: Task[],
  config: ScheduleConfig
): ScheduledTask[]
```

### WorkingDaysCalendar Interface
```typescript
class WorkingDaysCalendar {
  constructor(nonWorkingDays?: string[])
  isWorkingDay(date: string): boolean
  addWorkingDays(startDate: string, days: number): string
  nextWorkingDay(date: string): string
}
```

## Error Handling

- Validates velocity > 0, sprint duration > 0, estimates >= 0
- Validates project start date format
- Handles negative estimates by using 0
- Clear error messages for all validation failures
- Edge cases: zero estimates, year boundaries, leap years

## Testing

### Schedule Calculator Tests
- Duration calculation formula validation
- Fractional and whole number duration results
- Date arithmetic with month/year boundaries and leap years
- Sequential task processing
- Preservation of all original task fields
- Edge cases: zero estimates, negative estimates, empty task lists
- Error handling: zero/negative velocity, zero/negative sprint duration, invalid dates

### WorkingDaysCalendar Tests
- Working day identification (Monday-Friday, weekends, holidays)
- Fractional duration calculations with rounding
- Weekend skipping logic
- Holiday exclusion
- Edge cases: zero days, negative days, invalid dates, year boundaries, leap years
- Acceptance criteria scenarios (AC1-AC4)

### Output Generator Tests
- JSON file generation with proper formatting
- Field preservation in output
- Empty task array handling
- Default path handling

**Total:** 135+ tests, all passing

## Dependencies

- Configuration system for velocity, sprint duration, project start date, non-working days
- Task model from CSV ingestion subsystem

## Related Files

- Implementation: `src/calculators/schedule-calculator.ts`, `src/calculators/working-days-calculator.ts`, `src/output/output-generator.ts`
- Tests: `src/calculators/__tests__/schedule-calculator.test.ts`, `src/calculators/__tests__/working-days-calculator.test.ts`, `src/output/__tests__/output-generator.test.ts`

## Backward Compatibility

- `addDays()` function retained (deprecated) for backward compatibility
- All new schedule calculations use `WorkingDaysCalendar`
- `nonWorkingDays` is optional in configuration (defaults to weekends only)

