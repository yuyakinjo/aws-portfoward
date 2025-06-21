import { messages } from "./messages.js";

interface ErrorDetails {
  title: string;
  message: string;
  suggestions: string[];
  technicalDetails?: string;
  documentation?: string;
}

export function displayFriendlyError(error: unknown): void {
  const errorDetails = getErrorDetails(error);

  messages.empty();
  messages.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  messages.bold.error(`❌ ${errorDetails.title}`);
  messages.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  messages.empty();

  // Main message
  messages.bold.white("🔍 Problem:");
  messages.white(`   ${errorDetails.message}`);
  messages.empty();

  // Present solutions
  if (errorDetails.suggestions.length > 0) {
    messages.bold.warning("💡 Hint:");
    for (let i = 0; i < errorDetails.suggestions.length; i++) {
      messages.warning(`   ${i + 1}. ${errorDetails.suggestions[i]}`);
    }
    messages.empty();
  }

  // Technical details (for developers)
  if (errorDetails.technicalDetails) {
    messages.bold.gray("🔧 Details:");
    messages.gray(`   ${errorDetails.technicalDetails}`);
    messages.empty();
  }

  // Documentation links
  if (errorDetails.documentation) {
    messages.bold.info("📚 Reference:");
    messages.info(`   ${errorDetails.documentation}`);
    messages.empty();
  }

  messages.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  messages.empty();
}

function getErrorDetails(error: unknown): ErrorDetails {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // AWS authentication related errors
  if (
    errorMessage.includes("UnauthorizedOperation") ||
    errorMessage.includes("AccessDenied") ||
    errorMessage.includes("InvalidUserID.NotFound")
  ) {
    return {
      title: "AWS Authentication Error",
      message: "No access permission to AWS resources",
      suggestions: [
        "Please check your AWS CLI credentials (`aws configure list`)",
        "Please verify that appropriate IAM policies are configured",
        "Please verify that your AWS CLI profile is correctly configured",
        "If MFA authentication is required, please obtain temporary authentication tokens",
      ],
      technicalDetails: errorMessage,
      documentation:
        "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html",
    };
  }

  // Network related errors
  if (
    errorMessage.includes("NetworkingError") ||
    errorMessage.includes("TimeoutError") ||
    errorMessage.includes("ENOTFOUND") ||
    errorMessage.includes("ECONNREFUSED")
  ) {
    return {
      title: "Network Connection Error",
      message: "Failed to connect to AWS services",
      suggestions: [
        "Please check your internet connection",
        "Please verify your proxy settings are correct",
        "Please check your firewall settings",
        "If VPN connection is required, please connect to VPN",
        "Please try again after some time",
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/general/latest/gr/rande.html",
    };
  }

  // Region related errors
  if (
    errorMessage.includes("InvalidRegion") ||
    errorMessage.includes("Failed to get AWS regions")
  ) {
    return {
      title: "AWS Region Error",
      message: "Failed to get or specify AWS region",
      suggestions: [
        "Please check AWS CLI authentication",
        "Please check the default region in your AWS CLI configuration",
        "Please check the list of available regions (`aws ec2 describe-regions`)",
        "Please check your network connection",
      ],
      technicalDetails: errorMessage,
      documentation: "https://docs.aws.amazon.com/general/latest/gr/rande.html",
    };
  }

  // ECS related errors
  if (
    errorMessage.includes("No ECS clusters found") ||
    errorMessage.includes("ClusterNotFoundException")
  ) {
    return {
      title: "ECS Cluster Not Found",
      message:
        "No ECS cluster exists in the specified region or no access permission",
      suggestions: [
        "Please verify you have selected the correct region",
        "Please verify that ECS clusters have been created",
        "Please verify you have ECS-related IAM permissions",
        "Please try a different region",
      ],
      technicalDetails: errorMessage,
      documentation:
        "https://docs.aws.amazon.com/ecs/latest/developerguide/create-cluster.html",
    };
  }

  // ECS task related errors
  if (errorMessage.includes("No running ECS tasks found")) {
    return {
      title: "ECS Task Not Found",
      message: "No running tasks in the selected cluster",
      suggestions: [
        "Please verify that ECS services are running",
        "Please verify that tasks are in RUNNING state",
        "Please try a different cluster",
        "Please check task status in the ECS console",
      ],
      technicalDetails: errorMessage,
      documentation:
        "https://docs.aws.amazon.com/ecs/latest/developerguide/ecs_run_task.html",
    };
  }

  // RDS related errors
  if (
    errorMessage.includes("No RDS instances found") ||
    errorMessage.includes("DBInstanceNotFound")
  ) {
    return {
      title: "RDS Instance Not Found",
      message:
        "No RDS instance exists in the specified region or no access permission",
      suggestions: [
        "Please verify you have selected the correct region",
        "Please verify that RDS instances have been created",
        "Please verify you have RDS-related IAM permissions",
        "Please try a different region",
      ],
      technicalDetails: errorMessage,
      documentation:
        "https://docs.aws.amazon.com/rds/latest/userguide/CHAP_GettingStarted.html",
    };
  }

  // SSM related errors
  if (
    errorMessage.includes("Cannot connect to target") ||
    errorMessage.includes("TargetNotConnected")
  ) {
    return {
      title: "SSM Connection Error",
      message: "Cannot connect to the target ECS task",
      suggestions: [
        "Please verify that the ECS task is running",
        "Please verify that SSM Agent is enabled on the task",
        "Please verify that the task has appropriate IAM roles for SSM",
        "Please check the task's network configuration",
      ],
      technicalDetails: errorMessage,
      documentation:
        "https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html",
    };
  }

  // AWS CLI related errors
  if (
    errorMessage.includes("AWS CLI may not be installed") ||
    errorMessage.includes("aws: command not found")
  ) {
    return {
      title: "AWS CLI Not Found",
      message: "AWS CLI is not installed or not accessible",
      suggestions: [
        "Please install AWS CLI v2",
        "Please verify that AWS CLI is in your PATH",
        "Please verify you have execution permissions for AWS CLI",
        "Please restart your terminal after installation",
      ],
      technicalDetails: errorMessage,
      documentation:
        "https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html",
    };
  }

  // Port related errors
  if (
    errorMessage.includes("address already in use") ||
    errorMessage.includes("EADDRINUSE")
  ) {
    return {
      title: "Port Already In Use",
      message: "The specified local port is already being used",
      suggestions: [
        "Please try a different port number",
        "Please check if another process is using the port",
        "Please terminate other port forwarding sessions",
        "Please use 'lsof -i :PORT_NUMBER' to check port usage",
      ],
      technicalDetails: errorMessage,
      documentation: "",
    };
  }

  // Maximum retry errors
  if (errorMessage.includes("maximum retry count")) {
    return {
      title: "Maximum Retry Count Reached",
      message: "Process terminated after multiple failed attempts",
      suggestions: [
        "Please check your network connection",
        "Please verify your AWS credentials and permissions",
        "Please try again after resolving the above issues",
        "Please check if AWS services are experiencing issues",
      ],
      technicalDetails: errorMessage,
      documentation: "https://status.aws.amazon.com/",
    };
  }

  // Default error
  return {
    title: "Unexpected Error",
    message: errorMessage || "An unknown error occurred",
    suggestions: [
      "Please try again",
      "Please check your network connection",
      "Please verify your AWS configuration",
      "If the problem persists, please check AWS service status",
    ],
    technicalDetails: errorMessage,
    documentation: "https://docs.aws.amazon.com/",
  };
}
