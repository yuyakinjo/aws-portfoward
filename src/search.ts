import chalk from "chalk";
import Fuse from "fuse.js";
import type { AWSRegion, ECSCluster, ECSTask, RDSInstance } from "./types.js";

// zoxide-style fuzzy search function
export function fuzzySearchClusters(clusters: ECSCluster[], input: string) {
  const fuseOptions = {
    keys: ["clusterName"],
    threshold: 0.5, // Flexible search like zoxide
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true,
  };

  if (!input || input.trim() === "") {
    return clusters.map((cluster) => ({
      name: `${cluster.clusterName} ${chalk.dim(`(${cluster.clusterArn.split("/").pop()})`)}`,
      value: cluster,
    }));
  }

  const fuse = new Fuse(clusters, fuseOptions);
  const results = fuse.search(input);

  // zoxide-style: Sort by score with score display
  return results
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .map((result, index) => ({
      name: `${index === 0 ? chalk.green("•") : "  "} ${result.item.clusterName} ${chalk.dim(`(${result.item.clusterArn.split("/").pop()}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
      value: result.item,
    }));
}

// ECS task fuzzy search function (zoxide-style)
export function fuzzySearchTasks(tasks: ECSTask[], input: string) {
  const fuseOptions = {
    keys: ["serviceName", "taskId", "displayName"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true,
  };

  if (!input || input.trim() === "") {
    return tasks.map((task) => ({
      name: task.serviceName,
      value: task.taskArn,
    }));
  }

  const fuse = new Fuse(tasks, fuseOptions);
  const results = fuse.search(input);

  return results
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .map((result, index) => ({
      name: `${index === 0 ? chalk.green("•") : "  "} ${result.item.serviceName} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
      value: result.item.taskArn,
    }));
}

// RDS instance fuzzy search function (zoxide-style)
export function fuzzySearchRDS(rdsInstances: RDSInstance[], input: string) {
  const fuseOptions = {
    keys: ["dbInstanceIdentifier", "engine", "endpoint"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true,
  };

  if (!input || input.trim() === "") {
    return rdsInstances.map((rds) => ({
      name: `(${rds.engine}): ${rds.dbInstanceIdentifier}`,
      value: rds,
    }));
  }

  const fuse = new Fuse(rdsInstances, fuseOptions);
  const results = fuse.search(input);

  return results
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .map((result, index) => ({
      name: `${index === 0 ? chalk.green("•") : "  "} (${result.item.engine}): ${result.item.dbInstanceIdentifier} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
      value: result.item,
    }));
}

// zoxide-style real-time search function
export async function searchClusters(clusters: ECSCluster[], input: string) {
  const fuseOptions = {
    keys: ["clusterName"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true,
  };

  // Show all if input is empty
  if (!input || input.trim() === "") {
    return clusters.map((cluster) => ({
      name: `${cluster.clusterName} ${chalk.dim(`(${cluster.clusterArn.split("/").pop()})`)}`,
      value: cluster,
    }));
  }

  // Real-time fuzzy search with Fuse
  const fuse = new Fuse(clusters, fuseOptions);
  const results = fuse.search(input);

  // zoxide-style: Sort by score
  return results
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .map((result, index) => ({
      name: `${index === 0 ? chalk.green("•") : "  "} ${result.item.clusterName} ${chalk.dim(`(${result.item.clusterArn.split("/").pop()}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
      value: result.item,
    }));
}

// zoxide-style real-time search function - for ECS tasks
export async function searchTasks(tasks: ECSTask[], input: string) {
  const fuseOptions = {
    keys: ["serviceName", "taskId", "displayName"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true,
  };

  if (!input || input.trim() === "") {
    return tasks.map((task) => ({
      name: task.serviceName,
      value: task.taskArn,
    }));
  }

  const fuse = new Fuse(tasks, fuseOptions);
  const results = fuse.search(input);

  return results
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .map((result, index) => ({
      name: `${index === 0 ? chalk.green("•") : "  "} ${result.item.serviceName} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
      value: result.item.taskArn,
    }));
}

// zoxide-style real-time search function - for RDS
export async function searchRDS(rdsInstances: RDSInstance[], input: string) {
  const fuseOptions = {
    keys: ["dbInstanceIdentifier", "engine", "endpoint"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true,
  };

  if (!input || input.trim() === "") {
    return rdsInstances.map((rds) => ({
      name: `(${rds.engine}): ${rds.dbInstanceIdentifier}`,
      value: rds,
    }));
  }

  const fuse = new Fuse(rdsInstances, fuseOptions);
  const results = fuse.search(input);

  return results
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .map((result, index) => ({
      name: `${index === 0 ? chalk.green("•") : "  "} (${result.item.engine}): ${result.item.dbInstanceIdentifier} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
      value: result.item,
    }));
}

// zoxide-style real-time search function - for AWS regions
export async function searchRegions(
  regions: AWSRegion[],
  input: string,
  defaultRegion?: string,
) {
  const fuseOptions = {
    keys: ["regionName"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true,
  };

  if (!input || input.trim() === "") {
    // デフォルトリージョンがある場合は先頭に表示
    const sortedRegions = defaultRegion
      ? [
          ...regions.filter((r) => r.regionName === defaultRegion),
          ...regions.filter((r) => r.regionName !== defaultRegion),
        ]
      : regions;

    return sortedRegions.map((region, index) => {
      const isDefault = region.regionName === defaultRegion;
      const icon = index === 0 && isDefault ? chalk.green("•") : "  ";
      const defaultLabel = isDefault ? chalk.cyan(" (default)") : "";

      return {
        name: `${icon} ${region.regionName}${defaultLabel} ${chalk.dim(`(${region.optInStatus})`)}`,
        value: region.regionName,
      };
    });
  }

  const fuse = new Fuse(regions, fuseOptions);
  const results = fuse.search(input);

  return results
    .sort((a, b) => {
      // デフォルトリージョンを優先
      if (defaultRegion) {
        if (a.item.regionName === defaultRegion) return -1;
        if (b.item.regionName === defaultRegion) return 1;
      }
      return (a.score || 0) - (b.score || 0);
    })
    .map((result, index) => {
      const isDefault = result.item.regionName === defaultRegion;
      const icon = index === 0 ? chalk.green("•") : "  ";
      const defaultLabel = isDefault ? chalk.cyan(" (default)") : "";

      return {
        name: `${icon} ${result.item.regionName}${defaultLabel} ${chalk.dim(`(${result.item.optInStatus}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
        value: result.item.regionName,
      };
    });
}
