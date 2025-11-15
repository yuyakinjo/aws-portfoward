[![npm](https://img.shields.io/npm/v/ecs-pf)](https://www.npmjs.com/package/ecs-pf)
[![CI](https://github.com/yuyakinjo/aws-portfoward/actions/workflows/test.yml/badge.svg)](https://github.com/yuyakinjo/aws-portfoward/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/dt/ecs-pf)](https://www.npmjs.com/package/ecs-pf)

# AWS ECS-RDS Port Forwarding CLI

A modern CLI tool for connecting to RDS databases through AWS ECS tasks using SSM Session Manager.

## Features

- **Port Forwarding**: Easily forward RDS ports through ECS tasks
- **ECS Exec**: Execute commands in ECS containers with interactive UI
- **Enable ECS Exec**: Automatically enable ECS exec capability for services that need it

## Quick Start

### Interactive UI

```bash
npx ecs-pf connect
```

## Example Usage

### Interactive guided workflow

```bash
$ npx ecs-pf connect

Select Network Configuration
  Region      : ap-northeast-1
  RDS         : production-db
  (RDS port)  : 5432
  ECS Target  : api-task-abc123
  (ECS Cluster): production-cluster
  Local Port  : 8888

Connection established!
Database available at: localhost:8888
```

### ECS Task Execution

Execute commands in ECS containers:

```bash
# Interactive mode
npx ecs-pf exec

# Direct execution
npx ecs-pf exec \
  --region ap-northeast-1 \
  --cluster production-cluster \
  --task arn:aws:ecs:ap-northeast-1:123456789:task/production-cluster/abcdef123456 \
  --container web \
  --command "/bin/bash"

# Dry run for exec commands
npx ecs-pf exec --dry-run \
  --region ap-northeast-1 \
  --cluster production-cluster \
  --task arn:aws:ecs:ap-northeast-1:123456789:task/production-cluster/abcdef123456 \
  --container web \
  --command "/bin/bash"
```

### Enable ECS Exec

Enable ECS exec capability for services that don't have it enabled:

```bash
# Interactive mode - select services from all clusters
npx ecs-pf enable-exec --region ap-northeast-1

# Enable exec for specific service
npx ecs-pf enable-exec \
  --region ap-northeast-1 \
  --cluster production-cluster \
  --service api-service

# Enable exec for all services in a cluster
npx ecs-pf enable-exec \
  --region ap-northeast-1 \
  --cluster production-cluster

# Dry run to see what would be changed
npx ecs-pf enable-exec --dry-run \
  --region ap-northeast-1 \
  --cluster production-cluster \
  --service api-service
```

## Prerequisites

### Required AWS Setup

1. **ECS Exec enabled**: Your ECS cluster and tasks must have ECS exec capability
2. **IAM permissions**: Proper permissions for ECS, RDS, and SSM
3. **AWS CLI**: Installed and configured with appropriate credentials
4. **Session Manager Plugin**: Installed for AWS CLI

### Development Requirements

- **Bun**: 1.3.2 (managed by [mise](https://mise.jdx.dev/))
- To install mise: `curl https://mise.run | sh`
- After installing mise, run `mise install` in the project directory

## Troubleshooting

### No ECS clusters found with exec capability

This means your clusters don't have ECS exec enabled. Enable it with our built-in command:

```bash
# Interactive mode to select and enable services
npx ecs-pf enable-exec --region your-region

# Or enable manually with AWS CLI
aws ecs update-service \
  --cluster your-cluster \
  --service your-service \
  --enable-execute-command
```

### AWS CLI not found

```bash
# Check if AWS CLI is installed
aws --version

# Check if it's in PATH
which aws
```

### Session Manager Plugin not found

```bash
# Check if Session Manager Plugin is installed
session-manager-plugin --version
```

Install it from: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html

### Connection fails

- Verify your ECS task is running and healthy
- Check that RDS instance is accessible from the ECS task
- Ensure security groups allow the connection
- Verify IAM permissions for SSM and ECS exec

## Development

### Local Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run locally (interactive UI - default)
bun dist/cli.js connect
```
