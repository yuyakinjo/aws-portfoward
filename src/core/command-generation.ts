import type {
  ClusterName,
  DBInstanceIdentifier,
  Port,
  RegionName,
  TaskArn,
} from "../types.js";
import { VERSION } from "../version.js";

/**
 * Generate reproducible command string for connecting to RDS
 */
export const generateReproducibleCommand = (
  region: RegionName,
  cluster: ClusterName,
  task: TaskArn,
  rds: DBInstanceIdentifier,
  rdsPort: Port,
  localPort: Port,
): string =>
  `npx ecs-pf@${VERSION} connect --region ${region} --cluster ${cluster} --task ${task} --rds ${rds} --rds-port ${rdsPort} --local-port ${localPort}`;
