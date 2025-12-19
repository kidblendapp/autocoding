/**
 * Gantt Schedule Calculation System
 * Entry point for the CLI application.
 */

import { ingestCsv } from './cli/commands/ingest-csv';
import { extractJira } from './cli/commands/extract-jira';
import { generateGantt } from './cli/commands/generate-gantt';

// Simple CLI argument parsing
const args = process.argv.slice(2);

// Check for command type
if (args.includes('--generate-gantt')) {
  // Gantt chart generation command
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');
  const open = args.includes('--open');
  
  const input = inputIndex !== -1 && inputIndex < args.length - 1 
    ? args[inputIndex + 1] 
    : undefined;
  
  const output = outputIndex !== -1 && outputIndex < args.length - 1 
    ? args[outputIndex + 1] 
    : undefined;
  
  generateGantt({
    input,
    output,
    open,
  })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Gantt chart generation failed:', error.message);
      process.exit(1);
    });
} else if (args.includes('--extract-jira')) {
  // JIRA extraction command
  const configIndex = args.indexOf('--config');
  const outputIndex = args.indexOf('--output');
  const includeHistory = args.includes('--history');
  
  const config = configIndex !== -1 && configIndex < args.length - 1 
    ? args[configIndex + 1] 
    : undefined;
  
  const output = outputIndex !== -1 && outputIndex < args.length - 1 
    ? args[outputIndex + 1] 
    : undefined;
  
  extractJira({
    config,
    output,
    includeHistory,
  })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ JIRA extraction failed:', error.message);
      process.exit(1);
    });
} else {
  // CSV ingestion command (default)
  const inputIndex = args.indexOf('--input');
  if (inputIndex === -1 || inputIndex === args.length - 1) {
    console.error('Error: --input flag is required');
    console.error('Usage:');
    console.error('  CSV ingestion: node dist/index.js --input <csv-file-path> [--quiet]');
    console.error('  JIRA extraction: node dist/index.js --extract-jira [--config <config-file>] [--output <output-file>] [--history]');
    console.error('  Gantt chart: node dist/index.js --generate-gantt [--input <csv-file>] [--output <html-file>] [--open]');
    process.exit(1);
  }

  const inputFile = args[inputIndex + 1];
  const quiet = args.includes('--quiet');

  // Execute CSV ingestion and schedule calculation
  ingestCsv({
    input: inputFile,
    quiet,
  })
    .then((scheduledTasks) => {
      console.log('\n✅ CSV ingestion and schedule calculation completed successfully');
      console.log(`📊 Total tasks scheduled: ${scheduledTasks.length}`);
      console.log('📄 Output file: output.json');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ CSV ingestion and schedule calculation failed:', error.message);
      process.exit(1);
    });
}
