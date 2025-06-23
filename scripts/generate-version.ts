#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as v from "valibot";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PackageJsonSchema = v.object({
  version: v.string(),
  name: v.string(),
});

type PackageJson = v.InferInput<typeof PackageJsonSchema>;

// Read package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");

try {
  const rawPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const packageJson: PackageJson = v.parse(PackageJsonSchema, rawPackageJson);

  // Generate version.ts
  const versionContent = `// This file is auto-generated during build
// Do not edit manually
export const VERSION = "${packageJson.version}";
`;

  const versionPath = path.join(__dirname, "..", "src", "version.ts");
  fs.writeFileSync(versionPath, versionContent);

  console.log(`✅ Generated version.ts with version ${packageJson.version}`);
} catch (error) {
  console.error("❌ Failed to generate version.ts:");
  if (error instanceof v.ValiError) {
    console.error("Package.json validation failed:", v.flatten(error.issues).nested);
  } else {
    console.error(error);
  }
  process.exit(1);
}
