[![CI](https://github.com/yuyakinjo/aws-portfoward/actions/workflows/ci.yml/badge.svg)](https://github.com/yuyakinjo/aws-portfoward/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ecs-pf)](https://www.npmjs.com/package/ecs-pf)

# AWS ECS-RDS Port Forwarding CLI

A modern CLI tool for connecting to RDS databases through AWS ECS tasks using SSM Session Manager.

## Features

- **Step-by-step UI**: Clean, guided workflow with progressive disclosure
- **ECS Exec filtering**: Automatically excludes clusters without ECS exec capability  
- **Auto-detection**: RDS port and ECS cluster information filled automatically
- **Multiple workflows**: Choose between guided UI or traditional manual selection
- **Real-time search**: Fuzzy search for all AWS resources
- **Error prevention**: Pre-validates connections to avoid common failures

## Quick Start

### Recommended: Step-by-Step UI

```bash
# Interactive guided workflow (recommended for new users)
npx ecs-pf ui
```

### Traditional Manual Selection

```bash
# Traditional workflow (good for automation/experienced users)
npx ecs-pf connect
```

### With Command Line Arguments

```bash
# Pre-specify some options
npx ecs-pf connect --region ap-northeast-1 --cluster production-cluster

# Specify all options (no interaction needed)
npx ecs-pf connect \
  --region ap-northeast-1 \
  --cluster production-cluster \
  --task arn:aws:ecs:ap-northeast-1:123456789:task/production-cluster/abcdef123456 \
  --rds production-db \
  --rds-port 5432 \
  --local-port 8888
```

## Available Commands

| Command | Alias | Description | Best For |
|---------|-------|-------------|-----------|
| `ui` | `connect-ui` | Step-by-step guided workflow | New users, interactive use |
| `connect` | - | Traditional manual selection | CLI veterans, automation |

## Command Line Options

| Option | Short | Description | Example |
|--------|-------|-------------|---------|
| `--region` | `-r` | AWS region | `ap-northeast-1` |
| `--cluster` | `-c` | ECS cluster name | `production-cluster` |
| `--task` | `-t` | ECS task ARN | `arn:aws:ecs:...` |
| `--rds` | | RDS instance identifier | `production-db` |
| `--rds-port` | | RDS port number | `5432` |
| `--local-port` | `-p` | Local port number | `8888` |

## Example Usage

### Step-by-Step UI Workflow

```bash
$ npx ecs-pf ui

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

### Traditional Workflow

```bash
$ npx ecs-pf connect

Starting AWS ECS RDS connection tool...
Region (from CLI): ap-northeast-1
Getting ECS clusters with exec capability...
Found 15 clusters with ECS exec capability
? Search and select ECS cluster: production-cluster
? Search and select ECS task: api-task (abc123...)
Getting RDS instances...
? Search and select RDS instance: production-db (postgres)
RDS Port (auto-detected): 5432
? Enter local port number: 8888

Connection established!
```

## Prerequisites

### Required AWS Setup

1. **ECS Exec enabled**: Your ECS cluster and tasks must have ECS exec capability
2. **IAM permissions**: Proper permissions for ECS, RDS, and SSM
3. **AWS CLI**: Installed and configured with appropriate credentials
4. **Session Manager Plugin**: Installed for AWS CLI

### ECS Exec Configuration

Enable ECS exec on your service:

```bash
aws ecs update-service \
  --cluster your-cluster \
  --service your-service \
  --enable-execute-command
```

## Database Connection

Once port forwarding is established, connect from another terminal:

### PostgreSQL

```bash
psql -h localhost -p 8888 -U username -d database_name

# Connection string format
postgresql://username:password@localhost:8888/database_name
```

### MySQL

```bash
mysql -h localhost -P 8888 -u username -p database_name

# Connection string format  
mysql://username:password@localhost:8888/database_name
```

## Troubleshooting

### No ECS clusters found with exec capability

This means your clusters don't have ECS exec enabled. Enable it with:

```bash
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

# Run locally
node dist/cli.js ui
```

### Publishing to npm

```bash
# Login to npm
npm login

# Publish package
npm publish
```

### Package Configuration

- **Package name**: `ecs-pf`
- **Binary**: `dist/cli.js` (Node.js ESM)
- **Target**: Node.js 16+

## Version History

### v2.2.0 (Current)

- **NEW**: Step-by-step UI workflow (`ui` command)
- **NEW**: ECS exec capability filtering
- **IMPROVED**: Clean, emoji-free interface
- **IMPROVED**: Auto-filled RDS port and cluster detection
- **REMOVED**: Deprecated `connect-infer` command

### v2.1.0

- Enhanced error handling
- Improved inference capabilities

## License

MIT License
