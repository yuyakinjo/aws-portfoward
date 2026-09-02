import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import type { Candidate, CompleteProps } from "decopin-cli";
import {
  getAWSRegions,
  getECSClusters,
  getECSServices,
  getECSTasks,
  getRDSInstances,
} from "../../src/aws-services.js";

/**
 * Tab 補完の候補を AWS に聞く (decopin-cli の complete.tsx、ADR 38)。
 * 失敗したら空を返す。補完は「無ければファイル補完に落ちる」だけなので、
 * 認証が無い・region が決まっていない、はエラーではなく候補なし
 */

/** ここまでに打たれたオプションの最初の値 */
function typed(props: CompleteProps, name: string): string | undefined {
  const value = props.options[name]?.[0];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export async function regionCandidates(): Promise<Candidate[]> {
  const result = await getAWSRegions(new EC2Client({}));
  if (!result.success) return [];
  return result.data.map((region) => ({
    value: String(region.regionName),
    description: region.optInStatus,
  }));
}

export async function clusterCandidates(
  props: CompleteProps,
): Promise<Candidate[]> {
  const region = typed(props, "region");
  if (region === undefined) return [];
  const result = await getECSClusters(new ECSClient({ region }));
  if (!result.success) return [];
  return result.data.map((cluster) => ({ value: String(cluster.clusterName) }));
}

export async function taskCandidates(
  props: CompleteProps,
): Promise<Candidate[]> {
  const region = typed(props, "region");
  const clusterName = typed(props, "cluster");
  if (region === undefined || clusterName === undefined) return [];
  const ecs = new ECSClient({ region });
  const clusters = await getECSClusters(ecs);
  if (!clusters.success) return [];
  const cluster = clusters.data.find(
    (c) => String(c.clusterName) === clusterName,
  );
  if (cluster === undefined) return [];
  const tasks = await getECSTasks(ecs, cluster);
  if (!tasks.success) return [];
  return tasks.data.map((task) => ({
    value: String(task.taskId),
    description: `${task.serviceName} (${task.taskStatus})`,
  }));
}

export async function serviceCandidates(
  props: CompleteProps,
): Promise<Candidate[]> {
  const region = typed(props, "region");
  const clusterName = typed(props, "cluster");
  if (region === undefined || clusterName === undefined) return [];
  const ecs = new ECSClient({ region });
  const clusters = await getECSClusters(ecs);
  if (!clusters.success) return [];
  const cluster = clusters.data.find(
    (c) => String(c.clusterName) === clusterName,
  );
  if (cluster === undefined) return [];
  const services = await getECSServices(ecs, cluster);
  if (!services.success) return [];
  return services.data.map((service) => ({
    value: String(service.serviceName),
    description: `${service.runningCount}/${service.desiredCount} running`,
  }));
}

export async function rdsCandidates(
  props: CompleteProps,
): Promise<Candidate[]> {
  const region = typed(props, "region");
  if (region === undefined) return [];
  const result = await getRDSInstances(new RDSClient({ region }));
  if (!result.success) return [];
  return result.data.map((rds) => ({
    value: String(rds.dbInstanceIdentifier),
    description: `${rds.engine} ${rds.dbInstanceStatus}`,
  }));
}
