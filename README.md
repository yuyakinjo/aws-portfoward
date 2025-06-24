[![CI](https://github.com/yuyakinjo/aws-portfoward/actions/workflows/test.yml/badge.svg)](https://github.com/yuyakinjo/aws-portfoward/actions/workflows/ci.yml)
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
- **Dry Run mode**: Preview commands without execution for testing and debugging

## Quick Start

### Recommended: Step-by-Step UI

```bash
# Interactive guided workflow (recommended for new users)
npx ecs-pf connect-ui
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

# Dry run mode - preview commands without execution
npx ecs-pf connect --dry-run \
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
| `connect-ui` | - | Step-by-step guided workflow | New users, interactive use |
| `connect` | - | Traditional manual selection | CLI veterans, automation |
| `exec-task-ui` | - | Interactive ECS task execution | ECS container debugging |
| `exec-task` | - | Direct ECS task execution | Automation, scripting |

### Execution Options (exec-task commands)

| Option | Description | Example |
|--------|-------------|---------|
| `--container` | Container name | `web` |
| `--command` | Command to execute | `/bin/bash` |

### Special Options

| Option | Description | Available For |
|--------|-------------|---------------|
| `--dry-run` | Preview commands without execution | All commands |

## Example Usage

### Step-by-Step UI Workflow

```bash
$ npx ecs-pf connect-ui

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
npx ecs-pf exec-task-ui

# Direct execution
npx ecs-pf exec-task \
  --region ap-northeast-1 \
  --cluster production-cluster \
  --task arn:aws:ecs:ap-northeast-1:123456789:task/production-cluster/abcdef123456 \
  --container web \
  --command "/bin/bash"

# Dry run for exec commands
npx ecs-pf exec-task --dry-run \
  --region ap-northeast-1 \
  --cluster production-cluster \
  --task arn:aws:ecs:ap-northeast-1:123456789:task/production-cluster/abcdef123456 \
  --container web \
  --command "/bin/bash"
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
node dist/cli.js connect-ui
```

## CHANGELOG

### v2.2.10 (Current)

- **NEW**: Dry run mode (`--dry-run`) for all commands - preview AWS commands without execution
- **NEW**: ECS task execution commands (`exec-task`, `exec-task-ui`)
- **IMPROVED**: Command preview and reproducible command generation
- **IMPROVED**: Better error handling and validation

### v2.2.3

- **IMPROVED**: UI display optimization - ECS tasks now show service names only
- **IMPROVED**: Performance optimization for ECS target inference (faster RDS connection)
- **IMPROVED**: Automatic version detection from package.json
- **IMPROVED**: Command structure - `connect-ui` as main command (no alias)
- **UPDATED**: Documentation and README improvements

### v2.2.2

- **FIXED**: TypeScript build configuration improvements
- **IMPROVED**: Module resolution and JSON import handling

### v2.2.1

- **FIXED**: Minor bug fixes and stability improvements

### v2.2.0

- **NEW**: Step-by-step UI workflow (`connect-ui` command)
- **NEW**: ECS exec capability filtering
- **IMPROVED**: Clean, emoji-free interface
- **IMPROVED**: Auto-filled RDS port and cluster detection
- **REMOVED**: Deprecated `connect-infer` command

### v2.1.0

- Enhanced error handling
- Improved inference capabilities

## License

MIT License
