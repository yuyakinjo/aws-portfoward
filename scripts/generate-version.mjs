#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");

try {
  const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonContent);

  if (!packageJson.version || !packageJson.name) {
    throw new Error("package.json must have version and name fields");
  }

  // Create version.ts content
  const versionContent = `// This file is auto-generated during build process
// Do not edit manually

export const VERSION = "${packageJson.version}";
export const PACKAGE_NAME = "${packageJson.name}";
`;

  // Write version.ts
  const versionPath = path.join(__dirname, "..", "src", "version.ts");
  fs.writeFileSync(versionPath, versionContent, "utf8");

  // Use encodeURIComponent to sanitize user input before logging
  console.log(
    `✅ Generated version.ts with version ${encodeURIComponent(packageJson.version)}`,
  );
} catch (error) {
  console.error("❌ Error generating version.ts:", error.message);
  process.exit(1);
}
