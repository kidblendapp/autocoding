/**
 * Gantt Schedule Calculation System
 * Entry point for the CLI application.
 */

import { ingestCsv } from './cli/commands/ingest-csv';

// Simple CLI argument parsing
const args = process.argv.slice(2);

// Check for --input flag
const inputIndex = args.indexOf('--input');
if (inputIndex === -1 || inputIndex === args.length - 1) {
  console.error('Error: --input flag is required');
  console.error('Usage: node dist/index.js --input <csv-file-path> [--quiet]');
  process.exit(1);
}

const inputFile = args[inputIndex + 1];
const quiet = args.includes('--quiet');

// Execute CSV ingestion
ingestCsv({
  input: inputFile,
  quiet,
})
  .then((tasks) => {
    console.log('\n✅ CSV ingestion completed successfully');
    console.log(`📊 Total tasks: ${tasks.length}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ CSV ingestion failed:', error.message);
    process.exit(1);
  });
