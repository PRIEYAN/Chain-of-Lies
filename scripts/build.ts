#!/usr/bin/env node
/**
 * Build Script
 * 
 * Orchestrates the build process for all packages
 */
import { execSync } from "child_process";

const packages = [
  "packages/types",
  "packages/shared",
  "apps/api",
  "apps/web",
];

console.log("🔨 Building all packages...\n");

for (const pkg of packages) {
  console.log(`📦 Building ${pkg}...`);
  try {
    execSync(`pnpm --filter ./${pkg} build`, { stdio: "inherit" });
    console.log(`✅ ${pkg} built successfully\n`);
  } catch (error) {
    console.error(`❌ Failed to build ${pkg}`);
    process.exit(1);
  }
}

console.log("✨ All packages built successfully!");
