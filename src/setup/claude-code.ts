import { spawn } from "node:child_process";
import type { Credentials } from "./env.js";

export interface ConfigureOptions {
  dryRun?: boolean;
}

/**
 * Check if the Claude CLI is available.
 */
async function isClaudeCliAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("claude", ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Remove existing bento MCP server if it exists.
 * Silently ignores errors if it doesn't exist.
 */
async function removeExisting(): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("claude", ["mcp", "remove", "bento"], {
      stdio: ["ignore", "ignore", "ignore"],
      shell: true,
    });
    proc.on("error", () => resolve());
    proc.on("close", () => resolve());
  });
}

/**
 * Configure Bento MCP for Claude Code using the CLI.
 * This is the preferred method as it requires no file mutation.
 */
export async function configure(
  creds: Credentials,
  options: ConfigureOptions = {},
): Promise<boolean> {
  const { dryRun = false } = options;

  const args = [
    "mcp",
    "add",
    "bento",
    "--env",
    `BENTO_PUBLISHABLE_KEY=${creds.publishableKey}`,
    "--env",
    `BENTO_SECRET_KEY=${creds.secretKey}`,
    "--env",
    `BENTO_SITE_UUID=${creds.siteUuid}`,
    "--",
    "npx",
    "-y",
    "@bentonow/bento-mcp",
  ];

  if (dryRun) {
    console.log("\n[Claude Code] Would run:");
    console.log(`  claude ${args.join(" ")}`);
    return true;
  }

  // Check if Claude CLI is available
  const cliAvailable = await isClaudeCliAvailable();
  if (!cliAvailable) {
    console.log("\n[Claude Code] Claude CLI not found.");
    console.log("  Install Claude Code first, then run:");
    console.log(`  claude ${args.join(" ")}`);
    return false;
  }

  console.log("\n[Claude Code] Registering Bento MCP server...");

  // Remove existing entry first to ensure clean update
  await removeExisting();

  return new Promise((resolve) => {
    const proc = spawn("claude", args, {
      stdio: "inherit",
      shell: true,
    });

    proc.on("error", (err) => {
      console.error(`  Error: ${err.message}`);
      resolve(false);
    });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log("  Successfully registered Bento MCP server.");
        resolve(true);
      } else {
        console.error(`  Command exited with code ${code}`);
        resolve(false);
      }
    });
  });
}

/**
 * Get the command string for manual execution.
 */
export function getCommand(creds: Credentials): string {
  return `claude mcp add bento \\
  --env BENTO_PUBLISHABLE_KEY=${creds.publishableKey} \\
  --env BENTO_SECRET_KEY=${creds.secretKey} \\
  --env BENTO_SITE_UUID=${creds.siteUuid} \\
  -- npx -y @bentonow/bento-mcp`;
}
