import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { input, search } from "@inquirer/prompts";
import chalk from "chalk";
import { isEmpty } from "remeda";
import { getAWSRegions, getECSClusters, getECSTasks, getRDSInstances, } from "./aws-services.js";
import { searchClusters, searchRDS, searchRegions, searchTasks, } from "./search.js";
import { startSSMSession } from "./session.js";
import { askRetry, displayFriendlyError, getDefaultPortForEngine, } from "./utils.js";
export async function connectToRDS() {
    let retryCount = 0;
    const maxRetries = 3;
    while (retryCount <= maxRetries) {
        try {
            await connectToRDSInternal();
            return;
        }
        catch (error) {
            retryCount++;
            displayFriendlyError(error);
            if (retryCount <= maxRetries) {
                console.log(chalk.yellow(`🔄 Retry count: ${retryCount}/${maxRetries + 1}`));
                const shouldRetry = await askRetry();
                if (!shouldRetry) {
                    console.log(chalk.blue("👋 Process interrupted"));
                    return;
                }
                console.log(chalk.blue("🔄 Retrying...\n"));
            }
            else {
                console.log(chalk.red("❌ Maximum retry count reached. Terminating process."));
                console.log(chalk.gray("💡 If the problem persists, please check the above solutions."));
                throw error;
            }
        }
    }
}
async function connectToRDSInternal() {
    console.log(chalk.yellow("📋 Checking AWS configuration..."));
    const defaultEc2Client = new EC2Client({ region: "us-east-1" });
    console.log(chalk.yellow("🌍 Getting available AWS regions..."));
    const regions = await getAWSRegions(defaultEc2Client);
    if (isEmpty(regions)) {
        throw new Error("Failed to get AWS regions");
    }
    console.log(chalk.blue("💡 zoxide-style: List is filtered as you type (↑↓ to select, Enter to confirm)"));
    const region = await search({
        message: "🌍 Search and select AWS region:",
        source: async (input) => {
            return await searchRegions(regions, input || "");
        },
        pageSize: 12,
    });
    console.log(chalk.green(`✅ Region: ${region}`));
    const ecsClient = new ECSClient({ region });
    const rdsClient = new RDSClient({ region });
    console.log(chalk.yellow("🔍 Getting ECS clusters..."));
    const clusters = await getECSClusters(ecsClient);
    if (clusters.length === 0) {
        throw new Error("No ECS clusters found");
    }
    console.log(chalk.blue("💡 zoxide-style: List is filtered as you type (↑↓ to select, Enter to confirm)"));
    const selectedCluster = (await search({
        message: "🔍 Search and select ECS cluster:",
        source: async (input) => {
            return await searchClusters(clusters, input || "");
        },
        pageSize: 12,
    }));
    console.log(chalk.yellow("🔍 Getting ECS tasks..."));
    const tasks = await getECSTasks(ecsClient, selectedCluster);
    if (tasks.length === 0) {
        throw new Error("No running ECS tasks found");
    }
    const selectedTask = (await search({
        message: "🔍 Search and select ECS task:",
        source: async (input) => {
            return await searchTasks(tasks, input || "");
        },
        pageSize: 12,
    }));
    console.log(chalk.yellow("🔍 Getting RDS instances..."));
    const rdsInstances = await getRDSInstances(rdsClient);
    if (rdsInstances.length === 0) {
        throw new Error("No RDS instances found");
    }
    const selectedRDS = (await search({
        message: "🔍 Search and select RDS instance:",
        source: async (input) => {
            return await searchRDS(rdsInstances, input || "");
        },
        pageSize: 12,
    }));
    const defaultRDSPort = getDefaultPortForEngine(selectedRDS.engine);
    const rdsPort = await input({
        message: `Enter RDS port number (${selectedRDS.engine}):`,
        default: defaultRDSPort.toString(),
        validate: (inputValue) => {
            const port = parseInt(inputValue || defaultRDSPort.toString());
            return port > 0 && port < 65536
                ? true
                : "Please enter a valid port number (1-65535)";
        },
    });
    const localPort = await input({
        message: "Enter local port number:",
        default: "8888",
        validate: (inputValue) => {
            const port = parseInt(inputValue || "8888");
            return port > 0 && port < 65536
                ? true
                : "Please enter a valid port number (1-65535)";
        },
    });
    console.log(chalk.green("🚀 Starting port forwarding session..."));
    console.log(chalk.blue("Selected task:"), selectedTask);
    await startSSMSession(selectedTask, selectedRDS, rdsPort, localPort);
}
