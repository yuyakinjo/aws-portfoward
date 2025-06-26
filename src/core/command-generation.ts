import type { ReproducibleCommandParams } from "../types.js";
import { VERSION } from "../version.js";

/**
 * Generate reproducible command string for connecting to RDS
 */
export const generateReproducibleCommand = (
  params: ReproducibleCommandParams,
): string => {
  const { region, cluster, task, rds, rdsPort, localPort } = params;
  return `npx ecs-pf@${VERSION} connect --region ${region} --cluster ${cluster} --task ${task} --rds ${rds} --rds-port ${rdsPort} --local-port ${localPort}`;
};
