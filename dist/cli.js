#!/usr/bin/env node

// src/cli.ts
import chalk5 from "chalk";
import { Command } from "commander";

// src/aws-port-forward.ts
import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { input, search } from "@inquirer/prompts";
import chalk4 from "chalk";
import { isEmpty } from "remeda";

// src/aws-services.ts
import { DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import {
  DescribeClustersCommand,
  DescribeTasksCommand,
  ListClustersCommand,
  ListServicesCommand,
  ListTasksCommand
} from "@aws-sdk/client-ecs";
import {
  DescribeDBInstancesCommand
} from "@aws-sdk/client-rds";
async function getECSClusters(ecsClient) {
  try {
    const listCommand = new ListClustersCommand({});
    const listResponse = await ecsClient.send(listCommand);
    if (!listResponse.clusterArns || listResponse.clusterArns.length === 0) {
      return [];
    }
    const describeCommand = new DescribeClustersCommand({
      clusters: listResponse.clusterArns
    });
    const describeResponse = await ecsClient.send(describeCommand);
    const clusters = [];
    if (describeResponse.clusters) {
      for (const cluster of describeResponse.clusters) {
        if (cluster.clusterName && cluster.clusterArn) {
          clusters.push({
            clusterName: cluster.clusterName,
            clusterArn: cluster.clusterArn
          });
        }
      }
    }
    return clusters;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "UnauthorizedOperation" || error.name === "AccessDenied") {
        throw new Error("Access denied to ECS clusters. Please check your IAM policies.");
      }
      if (error.message.includes("region")) {
        throw new Error("ECS service is not available in the specified region.");
      }
    }
    throw new Error(`Failed to get ECS clusters: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function getECSTasks(ecsClient, cluster) {
  try {
    const servicesCommand = new ListServicesCommand({
      cluster: cluster.clusterName
    });
    const servicesResponse = await ecsClient.send(servicesCommand);
    const tasks = [];
    if (servicesResponse.serviceArns) {
      for (const serviceArn of servicesResponse.serviceArns) {
        const serviceName = serviceArn.split("/").pop() || serviceArn;
        const tasksCommand = new ListTasksCommand({
          cluster: cluster.clusterName,
          serviceName,
          desiredStatus: "RUNNING"
        });
        const tasksResponse = await ecsClient.send(tasksCommand);
        if (tasksResponse.taskArns) {
          const describeCommand = new DescribeTasksCommand({
            cluster: cluster.clusterName,
            tasks: tasksResponse.taskArns
          });
          const describeResponse = await ecsClient.send(describeCommand);
          if (describeResponse.tasks) {
            for (const task of describeResponse.tasks) {
              if (task.taskArn && task.containers && task.containers.length > 0 && task.lastStatus === "RUNNING") {
                const taskId = task.taskArn.split("/").pop() || task.taskArn;
                const clusterFullName = cluster.clusterArn.split("/").pop() || cluster.clusterName;
                const runtimeId = task.containers[0]?.runtimeId || "";
                if (runtimeId) {
                  const targetArn = `ecs:${clusterFullName}_${taskId}_${runtimeId}`;
                  const createdAt = task.createdAt ? new Date(task.createdAt).toLocaleString("en-US") : "";
                  const displayName = `${serviceName} | ${taskId.substring(0, 8)} | ${task.lastStatus} | ${createdAt}`;
                  tasks.push({
                    taskArn: targetArn,
                    displayName,
                    runtimeId,
                    taskId,
                    clusterName: clusterFullName,
                    serviceName,
                    taskStatus: task.lastStatus || "UNKNOWN",
                    createdAt: task.createdAt
                  });
                }
              }
            }
          }
        }
      }
    }
    return tasks;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "ClusterNotFoundException") {
        throw new Error(`ECS cluster "${cluster.clusterName}" not found. Please verify the cluster exists.`);
      }
      if (error.name === "UnauthorizedOperation" || error.name === "AccessDenied") {
        throw new Error("Access denied to ECS tasks. Please check your IAM policies.");
      }
    }
    throw new Error(`Failed to get ECS tasks: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function getAWSRegions(ec2Client) {
  try {
    const command = new DescribeRegionsCommand({});
    const response = await ec2Client.send(command);
    const regions = [];
    if (response.Regions) {
      for (const region of response.Regions) {
        if (region.RegionName) {
          regions.push({
            regionName: region.RegionName,
            optInStatus: region.OptInStatus || "opt-in-not-required"
          });
        }
      }
    }
    const priorityRegions = [
      "ap-northeast-1",
      "us-east-1",
      "us-west-2",
      "eu-west-1",
      "ap-northeast-2"
    ];
    return regions.sort((a, b) => {
      const aIndex = priorityRegions.indexOf(a.regionName);
      const bIndex = priorityRegions.indexOf(b.regionName);
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      } else if (aIndex !== -1) {
        return -1;
      } else if (bIndex !== -1) {
        return 1;
      } else {
        return a.regionName.localeCompare(b.regionName);
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "UnauthorizedOperation" || error.name === "AccessDenied") {
        throw new Error("Access denied to AWS regions. Please check your AWS credentials and IAM permissions.");
      }
    }
    throw new Error(`Failed to get AWS regions: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function getRDSInstances(rdsClient) {
  try {
    const command = new DescribeDBInstancesCommand({});
    const response = await rdsClient.send(command);
    const rdsInstances = [];
    if (response.DBInstances) {
      for (const db of response.DBInstances) {
        if (db.DBInstanceIdentifier && db.Endpoint?.Address && db.Engine && db.DBInstanceStatus === "available") {
          rdsInstances.push({
            dbInstanceIdentifier: db.DBInstanceIdentifier,
            endpoint: db.Endpoint.Address,
            engine: db.Engine,
            dbInstanceClass: db.DBInstanceClass || "unknown",
            dbInstanceStatus: db.DBInstanceStatus,
            allocatedStorage: db.AllocatedStorage || 0,
            availabilityZone: db.AvailabilityZone || "unknown",
            vpcSecurityGroups: db.VpcSecurityGroups?.map((sg) => sg.VpcSecurityGroupId || "") || [],
            dbSubnetGroup: db.DBSubnetGroup?.DBSubnetGroupName || undefined,
            createdTime: db.InstanceCreateTime || undefined
          });
        }
      }
    }
    return rdsInstances.sort((a, b) => a.dbInstanceIdentifier.localeCompare(b.dbInstanceIdentifier));
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "UnauthorizedOperation" || error.name === "AccessDenied") {
        throw new Error("Access denied to RDS instances. Please check your IAM policies.");
      }
    }
    throw new Error(`Failed to get RDS instances: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// src/search.ts
import chalk from "chalk";
import Fuse from "fuse.js";
async function searchClusters(clusters, input) {
  const fuseOptions = {
    keys: ["clusterName"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true
  };
  if (!input || input.trim() === "") {
    return clusters.map((cluster) => ({
      name: `${cluster.clusterName} ${chalk.dim(`(${cluster.clusterArn.split("/").pop()})`)}`,
      value: cluster
    }));
  }
  const fuse = new Fuse(clusters, fuseOptions);
  const results = fuse.search(input);
  return results.sort((a, b) => (a.score || 0) - (b.score || 0)).map((result, index) => ({
    name: `${index === 0 ? chalk.green("\uD83C\uDFAF") : "  "} ${result.item.clusterName} ${chalk.dim(`(${result.item.clusterArn.split("/").pop()}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
    value: result.item
  }));
}
async function searchTasks(tasks, input) {
  const fuseOptions = {
    keys: ["serviceName", "taskId", "displayName"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true
  };
  if (!input || input.trim() === "") {
    return tasks.map((task) => ({
      name: task.displayName,
      value: task.taskArn
    }));
  }
  const fuse = new Fuse(tasks, fuseOptions);
  const results = fuse.search(input);
  return results.sort((a, b) => (a.score || 0) - (b.score || 0)).map((result, index) => ({
    name: `${index === 0 ? chalk.green("\uD83C\uDFAF") : "  "} ${result.item.displayName} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
    value: result.item.taskArn
  }));
}
async function searchRDS(rdsInstances, input) {
  const fuseOptions = {
    keys: ["dbInstanceIdentifier", "engine", "endpoint"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true
  };
  if (!input || input.trim() === "") {
    return rdsInstances.map((rds) => ({
      name: `${rds.dbInstanceIdentifier} (${rds.engine}) - ${rds.endpoint}`,
      value: rds
    }));
  }
  const fuse = new Fuse(rdsInstances, fuseOptions);
  const results = fuse.search(input);
  return results.sort((a, b) => (a.score || 0) - (b.score || 0)).map((result, index) => ({
    name: `${index === 0 ? chalk.green("\uD83C\uDFAF") : "  "} ${result.item.dbInstanceIdentifier} (${result.item.engine}) - ${result.item.endpoint} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
    value: result.item
  }));
}
async function searchRegions(regions, input) {
  const fuseOptions = {
    keys: ["regionName"],
    threshold: 0.5,
    distance: 200,
    includeScore: true,
    minMatchCharLength: 1,
    findAllMatches: true
  };
  if (!input || input.trim() === "") {
    return regions.map((region) => ({
      name: `${region.regionName} ${chalk.dim(`(${region.optInStatus})`)}`,
      value: region.regionName
    }));
  }
  const fuse = new Fuse(regions, fuseOptions);
  const results = fuse.search(input);
  return results.sort((a, b) => (a.score || 0) - (b.score || 0)).map((result, index) => ({
    name: `${index === 0 ? chalk.green("\uD83C\uDFAF") : "  "} ${result.item.regionName} ${chalk.dim(`(${result.item.optInStatus}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
    value: result.item.regionName
  }));
}

// src/session.ts
import { spawn } from "node:child_process";
import chalk2 from "chalk";
async function startSSMSession(taskArn, rdsInstance, rdsPort, localPort) {
  const parameters = {
    host: [rdsInstance.endpoint],
    portNumber: [rdsPort],
    localPortNumber: [localPort]
  };
  const parametersJson = JSON.stringify(parameters);
  const commandString = `aws ssm start-session --target ${taskArn} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;
  console.log(chalk2.blue("Command to execute:"));
  console.log(chalk2.cyan(commandString));
  console.log("");
  console.log(chalk2.green(`\uD83C\uDFAF RDS connection will be available at localhost:${localPort}`));
  console.log(chalk2.yellow("Press Ctrl+C to terminate the session"));
  console.log("");
  return new Promise((resolve, reject) => {
    const child = spawn(commandString, [], {
      stdio: "inherit",
      env: process.env,
      shell: true
    });
    child.on("error", (error) => {
      console.error(chalk2.red("❌ Command execution error:"), error.message);
      if (error.message.includes("ENOENT")) {
        reject(new Error("AWS CLI may not be installed"));
      } else if (error.message.includes("EACCES")) {
        reject(new Error("No permission to execute AWS CLI"));
      } else {
        reject(new Error(`Command execution error: ${error.message}`));
      }
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (signal === "SIGINT" || code === 130 || isUserTermination) {
        console.log(chalk2.green("✅ Session terminated by user"));
        resolve();
        return;
      }
      if (code === 0) {
        console.log(chalk2.green("✅ Session terminated successfully"));
        resolve();
      } else {
        let errorMessage = `Session terminated with error code ${code}`;
        switch (code) {
          case 1:
            errorMessage += `
\uD83D\uDCA1 General error. Please check your AWS CLI configuration and permissions`;
            break;
          case 2:
            errorMessage += `
\uD83D\uDCA1 Configuration file or parameter issue`;
            break;
          case 255:
            errorMessage += `
\uD83D\uDCA1 Connection error or timeout. Please check network connection and target status`;
            break;
          default:
            errorMessage += `
\uD83D\uDCA1 Unexpected error. Please check AWS CLI logs`;
        }
        reject(new Error(errorMessage));
      }
    });
    let hasSessionStarted = false;
    child.stdout?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("Starting session") || output.includes("Port forwarding started")) {
        hasSessionStarted = true;
        console.log(chalk2.green("\uD83C\uDF89 Port forwarding session started!"));
      }
    });
    child.stderr?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("TargetNotConnected")) {
        console.error(chalk2.red("❌ Cannot connect to target"));
        console.error(chalk2.yellow("\uD83D\uDCA1 Please verify that the ECS task is running and SSM Agent is enabled"));
        reject(new Error("Cannot connect to target"));
      } else if (output.includes("AccessDenied")) {
        console.error(chalk2.red("❌ Access denied"));
        console.error(chalk2.yellow("\uD83D\uDCA1 Please verify you have SSM-related IAM permissions"));
        reject(new Error("Access denied"));
      } else if (output.includes("InvalidTarget")) {
        console.error(chalk2.red("❌ Invalid target"));
        console.error(chalk2.yellow("\uD83D\uDCA1 Please verify the specified ECS task exists and is running"));
        reject(new Error("Invalid target"));
      }
    });
    let isUserTermination = false;
    process.on("SIGINT", () => {
      console.log(chalk2.yellow(`
\uD83D\uDED1 Terminating session...`));
      isUserTermination = true;
      child.kill("SIGINT");
    });
    const timeout = setTimeout(() => {
      if (!hasSessionStarted) {
        console.error(chalk2.red("❌ Session start timed out"));
        console.error(chalk2.yellow("\uD83D\uDCA1 Please check network connection, target status, and permission settings"));
        child.kill("SIGTERM");
        reject(new Error("Session start timed out"));
      }
    }, 30000);
  });
}

// src/utils.ts
import chalk3 from "chalk";
import inquirer from "inquirer";
function getDefaultPortForEngine(engine) {
  const engineLower = engine.toLowerCase();
  if (engineLower.includes("mysql") || engineLower.includes("mariadb")) {
    return 3306;
  } else if (engineLower.includes("postgres")) {
    return 5432;
  } else if (engineLower.includes("oracle")) {
    return 1521;
  } else if (engineLower.includes("sqlserver") || engineLower.includes("mssql")) {
    return 1433;
  } else if (engineLower.includes("aurora-mysql")) {
    return 3306;
  } else if (engineLower.includes("aurora-postgresql")) {
    return 5432;
  } else {
    return 5432;
  }
}
function displayFriendlyError(error) {
  const errorDetails = getErrorDetails(error);
  console.log("");
  console.log(chalk3.red("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk3.red.bold(`❌ ${errorDetails.title}`));
  console.log(chalk3.red("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log("");
  console.log(chalk3.white.bold("\uD83D\uDD0D Problem:"));
  console.log(chalk3.white(`   ${errorDetails.message}`));
  console.log("");
  if (errorDetails.suggestions.length > 0) {
    console.log(chalk3.yellow.bold("\uD83D\uDCA1 Hint:"));
    for (let i = 0;i < errorDetails.suggestions.length; i++) {
      console.log(chalk3.yellow(`   ${i + 1}. ${errorDetails.suggestions[i]}`));
    }
    console.log("");
  }
  if (errorDetails.technicalDetails) {
    console.log(chalk3.gray.bold("\uD83D\uDD27 Details:"));
    console.log(chalk3.gray(`   ${errorDetails.technicalDetails}`));
    console.log("");
  }
  if (errorDetails.documentation) {
    console.log(chalk3.blue.bold("\uD83D\uDCDA Reference:"));
    console.log(chalk3.blue(`   ${errorDetails.documentation}`));
    console.log("");
  }
  console.log(chalk3.red("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log("");
}
function getErrorDetails(error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes("UnauthorizedOperation") || errorMessage.includes("AccessDenied") || errorMessage.includes("InvalidUserID.NotFound")) {
    return {
      title: "AWS Authentication Error",
      message: "No access permission to AWS resources",
      suggestions: [
        "Please check your AWS CLI credentials (`aws configure list`)",
        "Please verify that appropriate IAM policies are configured",
        "Please verify that your AWS CLI profile is correctly configured",
        "If MFA authentication is required, please obtain temporary authentication tokens"
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html"
    };
  }
  if (errorMessage.includes("NetworkingError") || errorMessage.includes("TimeoutError") || errorMessage.includes("ENOTFOUND") || errorMessage.includes("ECONNREFUSED")) {
    return {
      title: "Network Connection Error",
      message: "Failed to connect to AWS services",
      suggestions: [
        "Please check your internet connection",
        "Please verify your proxy settings are correct",
        "Please check your firewall settings",
        "If VPN connection is required, please connect to VPN",
        "Please try again after some time"
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/general/latest/gr/rande.html"
    };
  }
  if (errorMessage.includes("InvalidRegion") || errorMessage.includes("Failed to get AWS regions")) {
    return {
      title: "AWS Region Error",
      message: "Failed to get or specify AWS region",
      suggestions: [
        "Please check AWS CLI authentication",
        "Please check the default region in your AWS CLI configuration",
        "Please check the list of available regions (`aws ec2 describe-regions`)",
        "Please check your network connection"
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/general/latest/gr/rande.html"
    };
  }
  if (errorMessage.includes("No ECS clusters found") || errorMessage.includes("ClusterNotFoundException")) {
    return {
      title: "ECS Cluster Not Found",
      message: "No ECS cluster exists in the specified region or no access permission",
      suggestions: [
        "Please verify you have selected the correct region",
        "Please verify that ECS clusters have been created",
        "Please verify you have ECS-related IAM permissions",
        "Please try a different region"
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/ecs/latest/developerguide/create-cluster.html"
    };
  }
  if (errorMessage.includes("No running ECS tasks found")) {
    return {
      title: "ECS Task Not Found",
      message: "No running tasks in the selected cluster",
      suggestions: [
        "Please verify that ECS services are running",
        "Please verify that tasks are in RUNNING state",
        "Please try a different cluster",
        "Please check task status in the ECS console"
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/ecs/latest/developerguide/ecs_run_task.html"
    };
  }
  if (errorMessage.includes("No RDS instances found") || errorMessage.includes("DBInstanceNotFound")) {
    return {
      title: "RDS Instance Not Found",
      message: "No RDS instance exists in the specified region or no access permission",
      suggestions: [
        "Please verify you have selected the correct region",
        "Please verify that RDS instances have been created",
        "Please verify you have RDS-related IAM permissions",
        "Please try a different region"
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/rds/latest/userguide/CHAP_GettingStarted.html"
    };
  }
  if (errorMessage.includes("Cannot connect to target") || errorMessage.includes("TargetNotConnected")) {
    return {
      title: "SSM Connection Error",
      message: "Cannot connect to the target ECS task",
      suggestions: [
        "Please verify that the ECS task is running",
        "Please verify that SSM Agent is enabled on the task",
        "Please verify that the task has appropriate IAM roles for SSM",
        "Please check the task's network configuration"
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html"
    };
  }
  if (errorMessage.includes("AWS CLI may not be installed") || errorMessage.includes("aws: command not found")) {
    return {
      title: "AWS CLI Not Found",
      message: "AWS CLI is not installed or not accessible",
      suggestions: [
        "Please install AWS CLI v2",
        "Please verify that AWS CLI is in your PATH",
        "Please verify you have execution permissions for AWS CLI",
        "Please restart your terminal after installation"
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    };
  }
  if (errorMessage.includes("address already in use") || errorMessage.includes("EADDRINUSE")) {
    return {
      title: "Port Already In Use",
      message: "The specified local port is already being used",
      suggestions: [
        "Please try a different port number",
        "Please check if another process is using the port",
        "Please terminate other port forwarding sessions",
        "Please use 'lsof -i :PORT_NUMBER' to check port usage"
      ],
      technicalDetails: errorMessage,
      documentation: ""
    };
  }
  if (errorMessage.includes("maximum retry count")) {
    return {
      title: "Maximum Retry Count Reached",
      message: "Process terminated after multiple failed attempts",
      suggestions: [
        "Please check your network connection",
        "Please verify your AWS credentials and permissions",
        "Please try again after resolving the above issues",
        "Please check if AWS services are experiencing issues"
      ],
      technicalDetails: errorMessage,
      documentation: "https://status.aws.amazon.com/"
    };
  }
  return {
    title: "Unexpected Error",
    message: errorMessage || "An unknown error occurred",
    suggestions: [
      "Please try again",
      "Please check your network connection",
      "Please verify your AWS configuration",
      "If the problem persists, please check AWS service status"
    ],
    technicalDetails: errorMessage,
    documentation: "https://docs.aws.amazon.com/"
  };
}
async function askRetry() {
  const { shouldRetry } = await inquirer.prompt([
    {
      type: "confirm",
      name: "shouldRetry",
      message: "Would you like to retry?",
      default: true
    }
  ]);
  return shouldRetry;
}

// src/aws-port-forward.ts
async function connectToRDS() {
  let retryCount = 0;
  const maxRetries = 3;
  while (retryCount <= maxRetries) {
    try {
      await connectToRDSInternal();
      return;
    } catch (error) {
      retryCount++;
      displayFriendlyError(error);
      if (retryCount <= maxRetries) {
        console.log(chalk4.yellow(`\uD83D\uDD04 Retry count: ${retryCount}/${maxRetries + 1}`));
        const shouldRetry = await askRetry();
        if (!shouldRetry) {
          console.log(chalk4.blue("\uD83D\uDC4B Process interrupted"));
          return;
        }
        console.log(chalk4.blue(`\uD83D\uDD04 Retrying...
`));
      } else {
        console.log(chalk4.red("❌ Maximum retry count reached. Terminating process."));
        console.log(chalk4.gray("\uD83D\uDCA1 If the problem persists, please check the above solutions."));
        throw error;
      }
    }
  }
}
async function connectToRDSInternal() {
  console.log(chalk4.yellow("\uD83D\uDCCB Checking AWS configuration..."));
  const defaultEc2Client = new EC2Client({ region: "us-east-1" });
  console.log(chalk4.yellow("\uD83C\uDF0D Getting available AWS regions..."));
  const regions = await getAWSRegions(defaultEc2Client);
  if (isEmpty(regions)) {
    throw new Error("Failed to get AWS regions");
  }
  console.log(chalk4.blue("\uD83D\uDCA1 zoxide-style: List is filtered as you type (↑↓ to select, Enter to confirm)"));
  const region = await search({
    message: "\uD83C\uDF0D Search and select AWS region:",
    source: async (input2) => {
      return await searchRegions(regions, input2 || "");
    },
    pageSize: 12
  });
  console.log(chalk4.green(`✅ Region: ${region}`));
  const ecsClient = new ECSClient({ region });
  const rdsClient = new RDSClient({ region });
  console.log(chalk4.yellow("\uD83D\uDD0D Getting ECS clusters..."));
  const clusters = await getECSClusters(ecsClient);
  if (clusters.length === 0) {
    throw new Error("No ECS clusters found");
  }
  console.log(chalk4.blue("\uD83D\uDCA1 zoxide-style: List is filtered as you type (↑↓ to select, Enter to confirm)"));
  const selectedCluster = await search({
    message: "\uD83D\uDD0D Search and select ECS cluster:",
    source: async (input2) => {
      return await searchClusters(clusters, input2 || "");
    },
    pageSize: 12
  });
  console.log(chalk4.yellow("\uD83D\uDD0D Getting ECS tasks..."));
  const tasks = await getECSTasks(ecsClient, selectedCluster);
  if (tasks.length === 0) {
    throw new Error("No running ECS tasks found");
  }
  const selectedTask = await search({
    message: "\uD83D\uDD0D Search and select ECS task:",
    source: async (input2) => {
      return await searchTasks(tasks, input2 || "");
    },
    pageSize: 12
  });
  console.log(chalk4.yellow("\uD83D\uDD0D Getting RDS instances..."));
  const rdsInstances = await getRDSInstances(rdsClient);
  if (rdsInstances.length === 0) {
    throw new Error("No RDS instances found");
  }
  const selectedRDS = await search({
    message: "\uD83D\uDD0D Search and select RDS instance:",
    source: async (input2) => {
      return await searchRDS(rdsInstances, input2 || "");
    },
    pageSize: 12
  });
  const defaultRDSPort = getDefaultPortForEngine(selectedRDS.engine);
  const rdsPort = await input({
    message: `Enter RDS port number (${selectedRDS.engine}):`,
    default: defaultRDSPort.toString(),
    validate: (inputValue) => {
      const port = parseInt(inputValue || defaultRDSPort.toString());
      return port > 0 && port < 65536 ? true : "Please enter a valid port number (1-65535)";
    }
  });
  const localPort = await input({
    message: "Enter local port number:",
    default: "8888",
    validate: (inputValue) => {
      const port = parseInt(inputValue || "8888");
      return port > 0 && port < 65536 ? true : "Please enter a valid port number (1-65535)";
    }
  });
  console.log(chalk4.green("\uD83D\uDE80 Starting port forwarding session..."));
  console.log(chalk4.blue("Selected task:"), selectedTask);
  await startSSMSession(selectedTask, selectedRDS, rdsPort, localPort);
}

// src/cli.ts
var program = new Command;
program.name("aws-port-forward").description("CLI for port-forwarding to RDS via AWS ECS").version("1.0.0");
program.command("connect").description("Connect to RDS via ECS").action(async () => {
  try {
    console.log(chalk5.blue("\uD83D\uDE80 Starting AWS ECS RDS connection tool..."));
    await connectToRDS();
    console.log(chalk5.green("✅ Process completed successfully"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("maximum retry count")) {
      console.log(chalk5.red("\uD83D\uDEAB Terminating process"));
    } else {
      displayFriendlyError(error);
    }
    process.exit(1);
  }
});
process.on("unhandledRejection", (reason) => {
  console.log("");
  console.log(chalk5.red("❌ An unexpected error occurred"));
  displayFriendlyError(reason);
  process.exit(1);
});
process.on("uncaughtException", (error) => {
  console.log("");
  console.log(chalk5.red("❌ A critical error occurred"));
  displayFriendlyError(error);
  process.exit(1);
});
program.parse();
