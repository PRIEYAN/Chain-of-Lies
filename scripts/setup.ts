#!/usr/bin/env node
/**
 * Development Setup Script
 * 
 * Sets up the development environment
 */
import { execSync } from "child_process";
import { existsSync } from "fs";

console.log("🚀 Setting up Tamper Hunt development environment...\n");

// Check for pnpm
try {
  execSync("pnpm --version", { stdio: "pipe" });
} catch {
  console.error("❌ pnpm is required. Install it with: npm install -g pnpm");
  process.exit(1);
}

// Install dependencies
console.log("📦 Installing dependencies...");
execSync("pnpm install", { stdio: "inherit" });

// Build packages in order
console.log("\n🔨 Building shared packages...");
execSync("pnpm --filter @tamper-hunt/types build", { stdio: "inherit" });
execSync("pnpm --filter @tamper-hunt/shared build", { stdio: "inherit" });

// Check for .env file
if (!existsSync(".env")) {
  console.log("\n⚠️  No .env file found. Copy .env.example to .env and configure your environment.");
}

console.log("\n✨ Setup complete! Run 'pnpm dev' to start development.");
