/**
 * Generate reproducible command string for connecting to RDS
 */
export function generateReproducibleCommand(
  region: string,
  cluster: string,
  task: string,
  rds: string,
  rdsPort: string,
  localPort: string,
): string {
  return `npx ecs-pf connect --region ${region} --cluster ${cluster} --task ${task} --rds ${rds} --rds-port ${rdsPort} --local-port ${localPort}`;
}
