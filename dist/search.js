import chalk from "chalk";
import Fuse from "fuse.js";
export function fuzzySearchClusters(clusters, input) {
    const fuseOptions = {
        keys: ["clusterName"],
        threshold: 0.5,
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
    return results
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .map((result, index) => ({
        name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.clusterName} ${chalk.dim(`(${result.item.clusterArn.split("/").pop()}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
        value: result.item,
    }));
}
export function fuzzySearchTasks(tasks, input) {
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
            name: task.displayName,
            value: task.taskArn,
        }));
    }
    const fuse = new Fuse(tasks, fuseOptions);
    const results = fuse.search(input);
    return results
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .map((result, index) => ({
        name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.displayName} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
        value: result.item.taskArn,
    }));
}
export function fuzzySearchRDS(rdsInstances, input) {
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
            name: `${rds.dbInstanceIdentifier} (${rds.engine}) - ${rds.endpoint}`,
            value: rds,
        }));
    }
    const fuse = new Fuse(rdsInstances, fuseOptions);
    const results = fuse.search(input);
    return results
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .map((result, index) => ({
        name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.dbInstanceIdentifier} (${result.item.engine}) - ${result.item.endpoint} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
        value: result.item,
    }));
}
export async function searchClusters(clusters, input) {
    const fuseOptions = {
        keys: ["clusterName"],
        threshold: 0.5,
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
    return results
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .map((result, index) => ({
        name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.clusterName} ${chalk.dim(`(${result.item.clusterArn.split("/").pop()}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
        value: result.item,
    }));
}
export async function searchTasks(tasks, input) {
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
            name: task.displayName,
            value: task.taskArn,
        }));
    }
    const fuse = new Fuse(tasks, fuseOptions);
    const results = fuse.search(input);
    return results
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .map((result, index) => ({
        name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.displayName} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
        value: result.item.taskArn,
    }));
}
export async function searchRDS(rdsInstances, input) {
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
            name: `${rds.dbInstanceIdentifier} (${rds.engine}) - ${rds.endpoint}`,
            value: rds,
        }));
    }
    const fuse = new Fuse(rdsInstances, fuseOptions);
    const results = fuse.search(input);
    return results
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .map((result, index) => ({
        name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.dbInstanceIdentifier} (${result.item.engine}) - ${result.item.endpoint} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
        value: result.item,
    }));
}
export async function searchRegions(regions, input) {
    const fuseOptions = {
        keys: ["regionName"],
        threshold: 0.5,
        distance: 200,
        includeScore: true,
        minMatchCharLength: 1,
        findAllMatches: true,
    };
    if (!input || input.trim() === "") {
        return regions.map((region) => ({
            name: `${region.regionName} ${chalk.dim(`(${region.optInStatus})`)}`,
            value: region.regionName,
        }));
    }
    const fuse = new Fuse(regions, fuseOptions);
    const results = fuse.search(input);
    return results
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .map((result, index) => ({
        name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.regionName} ${chalk.dim(`(${result.item.optInStatus}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
        value: result.item.regionName,
    }));
}
