# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AWS ECS-RDS Port Forwarding CLI (`ecs-pf`) - A TypeScript CLI tool that enables secure connections to RDS databases through AWS ECS tasks using SSM Session Manager. The tool provides interactive prompts for ease of use and supports ECS exec functionality.

## Development Commands

### Build & Run
```bash
# Build the project (compiles TypeScript, generates version, adds shebang)
npm run build

# Run the CLI commands locally after building
npm run connect      # Port forwarding to RDS
npm run exec         # Execute commands in ECS containers
npm run enable-exec  # Enable ECS exec on services
```

### Testing
```bash
# Run all tests (type-check + build + unit + integration)
npm test

# Run specific test suites
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch        # Watch mode for development
npm run test:coverage     # Run with coverage report
npm run test:ui           # Open Vitest UI

# Type checking only (no build)
npm run type-check
```

### Code Quality
```bash
# Biome - formatter and linter combined
npm run check          # Format and lint (with fixes)
npm run check:dry      # Check without applying fixes
npm run format         # Format only
npm run lint           # Lint only
npm run ci             # Run all checks in CI mode
```

## Architecture

### Core Flow
1. **CLI Entry** (`src/cli.ts`) - Commander-based CLI with three commands: `connect`, `exec`, `enable-exec`
2. **Interactive UI** (`src/core/ui-flows/`) - Inquirer-based prompts for resource selection
3. **AWS Integration** (`src/utils/`) - AWS SDK v3 clients for EC2, ECS, RDS, SSM
4. **Connection Logic** (`src/core/connection-flows/`) - Handles port forwarding setup
5. **Inference Engine** (`src/inference/`) - Smart scoring system for ECS cluster/task selection based on VPC/subnet matching

### Key Components

- **Type Safety**: Uses Valibot for runtime validation with schemas in `src/types/`
- **Error Handling**: Centralized error handling with custom error types in `src/utils/errors.ts`
- **Testing**: Comprehensive mocks for AWS SDK clients in `test/mocks/`
- **Smart Selection**: Fuzzy search with Fuse.js and inference scoring for better UX

### Directory Structure
- `src/programs/` - Command implementations (connect, exec, enable-exec)
- `src/core/` - Business logic for connections and UI flows
- `src/inference/` - Scoring algorithms for intelligent resource selection
- `src/utils/` - Shared utilities (AWS clients, validation, formatting)
- `test/` - Test suites with mocks and fixtures

## Important Considerations

- **Node Version**: Project uses Node 24.11.1 (managed by mise)
- **Module System**: ESM modules (`"type": "module"` in package.json)
- **Build Process**: Custom build script that handles TypeScript compilation and CLI setup
- **AWS Permissions**: Requires proper IAM permissions for ECS, RDS, EC2, and SSM
- **Dependencies**: AWS SDK v3, Inquirer for prompts, Commander for CLI, Chalk for output formatting