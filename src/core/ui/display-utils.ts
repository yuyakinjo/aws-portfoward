/**
 * Clear the loading message from the terminal
 */
export function clearLoadingMessage(): void {
  process.stdout.write("\x1b[1A"); // Move cursor up
  process.stdout.write("\x1b[2K"); // Clear line
  process.stdout.write("\r"); // Move to start
}

/**
 * Display CLI arguments if provided
 */
export function displayCLIArguments(options: {
  region?: string;
  cluster?: string;
  task?: string;
  rds?: string;
  rdsPort?: string;
  localPort?: string;
  dryRun?: boolean;
}): string[] {
  const cliArgs = [];
  if (options.region) cliArgs.push(`--region ${options.region}`);
  if (options.cluster) cliArgs.push(`--cluster ${options.cluster}`);
  if (options.task) cliArgs.push(`--task ${options.task}`);
  if (options.rds) cliArgs.push(`--rds ${options.rds}`);
  if (options.rdsPort) cliArgs.push(`--rds-port ${options.rdsPort}`);
  if (options.localPort) cliArgs.push(`--local-port ${options.localPort}`);
  if (options.dryRun) cliArgs.push(`--dry-run`);
  
  return cliArgs;
}