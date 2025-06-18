#!/usr/bin/env bun

import chalk from "chalk";
import { Command } from "commander";
import { connectToRDS } from "./aws-port-forward.ts";

const program = new Command();

program
	.name("aws-port-forward")
	.description("AWS ECS経由でRDSにポートフォワーディング接続するCLI")
	.version("1.0.0");

program
	.command("connect")
	.description("ECS経由でRDSに接続")
	.action(async () => {
		try {
			console.log(chalk.blue("🚀 AWS ECS経由RDS接続ツールを開始します..."));
			await connectToRDS();
		} catch (error) {
			console.error(chalk.red("❌ エラーが発生しました:"), error);
			process.exit(1);
		}
	});

program.parse();
