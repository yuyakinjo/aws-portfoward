import { COMMAND_FORMATTING } from "../utils/index.js";
import { VERSION } from "../version.js";

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
  const { LINE_CONTINUATION } = COMMAND_FORMATTING;
  return `npx ecs-pf@${VERSION} connect${LINE_CONTINUATION}--region ${region}${LINE_CONTINUATION}--cluster ${cluster}${LINE_CONTINUATION}--task ${task}${LINE_CONTINUATION}--rds ${rds}${LINE_CONTINUATION}--rds-port ${rdsPort}${LINE_CONTINUATION}--local-port ${localPort}`;
}
