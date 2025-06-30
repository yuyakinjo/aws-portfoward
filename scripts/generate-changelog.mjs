#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";

/**
 * CHANGELOG.mdを自動生成するスクリプト
 * GitHubのリリース情報を基にCHANGELOGを生成します
 */

const CHANGELOG_FILE = "CHANGELOG.md";

/**
 * conventional-changelogを使用してCHANGELOGを生成
 */
function generateChangelog() {
  try {
    console.log("🔄 CHANGELOG.mdを生成中...");

    // conventional-changelogを実行してCHANGELOGを生成
    execSync(
      "npx conventional-changelog -p conventionalcommits -i CHANGELOG.md -s -r 0",
      {
        encoding: "utf8",
        cwd: process.cwd(),
      },
    );

    console.log("✅ CHANGELOG.mdが正常に生成されました");

    // 生成されたCHANGELOGの内容を確認
    if (fs.existsSync(CHANGELOG_FILE)) {
      const content = fs.readFileSync(CHANGELOG_FILE, "utf8");
      const lines = content.split("\n").slice(0, 10);
      console.log("\n📄 生成されたCHANGELOG（最初の10行）:");
      console.log(lines.join("\n"));
    }
  } catch (error) {
    console.error("❌ CHANGELOG生成中にエラーが発生しました:", error.message);
    process.exit(1);
  }
}

/**
 * 初回のCHANGELOGを作成（ファイルが存在しない場合）
 */
function createInitialChangelog() {
  if (!fs.existsSync(CHANGELOG_FILE)) {
    console.log("📝 初回のCHANGELOG.mdを作成中...");

    const initialContent = `# Changelog

このファイルは[conventional-changelog](https://github.com/conventional-changelog/conventional-changelog)によって自動生成されています。

すべての重要な変更はこのファイルに記録されます。

このプロジェクトは[Semantic Versioning](https://semver.org/spec/v2.0.0.html)に従っています。

`;

    fs.writeFileSync(CHANGELOG_FILE, initialContent, "utf8");
    console.log("✅ 初回のCHANGELOG.mdを作成しました");
  }
}

/**
 * メイン処理
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "init":
      createInitialChangelog();
      break;
    case "generate":
      generateChangelog();
      break;
    default:
      createInitialChangelog();
      generateChangelog();
      break;
  }
}

main();
