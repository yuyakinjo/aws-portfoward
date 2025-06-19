import { spawn } from "node:child_process";
import chalk from "chalk";
import type { RDSInstance } from "./types.js";

export async function startSSMSession(
	taskArn: string,
	rdsInstance: RDSInstance,
	rdsPort: string,
	localPort: string,
): Promise<void> {
	const parameters = {
		host: [rdsInstance.endpoint],
		portNumber: [rdsPort],
		localPortNumber: [localPort],
	};

	// コマンド文字列を構築（JSONパラメータを適切にエスケープ）
	const parametersJson = JSON.stringify(parameters);
	const commandString = `aws ssm start-session --target ${taskArn} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;

	console.log(chalk.blue("実行コマンド:"));
	console.log(chalk.cyan(commandString));
	console.log("");
	console.log(
		chalk.green(`🎯 localhost:${localPort} でRDS接続が利用可能になります`),
	);
	console.log(chalk.yellow("セッションを終了するには Ctrl+C を押してください"));
	console.log("");

	const child = spawn(commandString, [], {
		stdio: "inherit",
		env: process.env,
		shell: true,
	});

	child.on("error", (error) => {
		console.error(chalk.red("❌ コマンド実行エラー:"), error.message);
		if (error.message.includes("ENOENT")) {
			console.error(
				chalk.yellow("💡 AWS CLIがインストールされていない可能性があります"),
			);
		}
	});

	child.on("close", (code) => {
		if (code === 0) {
			console.log(chalk.green("✅ セッションが正常に終了しました"));
		} else {
			console.log(
				chalk.red(`❌ セッションがエラーコード ${code} で終了しました`),
			);
		}
	});

	// プロセス終了時の処理
	process.on("SIGINT", () => {
		console.log(chalk.yellow("\n🛑 セッションを終了しています..."));
		child.kill("SIGINT");
	});
}
