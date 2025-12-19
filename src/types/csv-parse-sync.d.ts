declare module 'csv-parse/sync' {
  // The library does not provide TypeScript types by default in this project.
  // We declare a minimal module typing to satisfy the compiler.
  export function parse(
    input: string,
    options?: Record<string, unknown>
  ): any;
}



