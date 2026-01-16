import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { Credentials } from "./env.js";

export interface ConfigureOptions {
  dryRun?: boolean;
  writeSecrets?: boolean;
}

/**
 * Get the Claude Desktop config file path based on OS.
 */
export function getConfigPath(): string {
  const home = homedir();

  if (process.platform === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    return join(appData, "Claude", "claude_desktop_config.json");
  }

  // Linux - use XDG or fallback
  const configHome = process.env.XDG_CONFIG_HOME || join(home, ".config");
  return join(configHome, "Claude", "claude_desktop_config.json");
}

/**
 * Create a backup of the config file with a timestamp.
 */
async function backupConfig(configPath: string): Promise<string | null> {
  if (!existsSync(configPath)) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = configPath.replace(".json", `.backup-${timestamp}.json`);

  await copyFile(configPath, backupPath);
  return backupPath;
}

/**
 * Get the Bento MCP server configuration block.
 */
export function getBentoConfig(
  creds: Credentials,
  writeSecrets = false,
): object {
  if (writeSecrets) {
    return {
      command: "npx",
      args: ["-y", "@bentonow/bento-mcp"],
      env: {
        BENTO_PUBLISHABLE_KEY: creds.publishableKey,
        BENTO_SECRET_KEY: creds.secretKey,
        BENTO_SITE_UUID: creds.siteUuid,
      },
    };
  }

  // Reference env vars (requires env file to be sourced)
  return {
    command: "npx",
    args: ["-y", "@bentonow/bento-mcp"],
    env: {
      BENTO_PUBLISHABLE_KEY: "${BENTO_PUBLISHABLE_KEY}",
      BENTO_SECRET_KEY: "${BENTO_SECRET_KEY}",
      BENTO_SITE_UUID: "${BENTO_SITE_UUID}",
    },
  };
}

/**
 * Configure Bento MCP for Claude Desktop by merging into the config file.
 */
export async function configure(
  creds: Credentials,
  options: ConfigureOptions = {},
): Promise<boolean> {
  const { dryRun = false, writeSecrets = true } = options;
  const configPath = getConfigPath();

  const bentoConfig = getBentoConfig(creds, writeSecrets);

  if (dryRun) {
    console.log("\n[Claude Desktop] Would modify:");
    console.log(`  ${configPath}`);
    console.log("\n  Adding mcpServers.bento:");
    console.log(
      `  ${JSON.stringify(bentoConfig, null, 2).split("\n").join("\n  ")}`,
    );
    return true;
  }

  console.log("\n[Claude Desktop] Configuring...");

  try {
    // Read existing config or create empty
    let config: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      const content = await readFile(configPath, "utf-8");
      try {
        config = JSON.parse(content);
      } catch {
        console.error(`  Error: Invalid JSON in ${configPath}`);
        return false;
      }

      // Create backup
      const backupPath = await backupConfig(configPath);
      if (backupPath) {
        console.log(`  Backup created: ${backupPath}`);
      }
    } else {
      // Ensure directory exists
      const dir = dirname(configPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    // Merge in bento config
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    (config.mcpServers as Record<string, unknown>).bento = bentoConfig;

    // Write back
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

    // Validate by re-reading
    const written = await readFile(configPath, "utf-8");
    JSON.parse(written); // Will throw if invalid

    console.log(`  Updated: ${configPath}`);
    console.log("  Restart Claude Desktop to apply changes.");
    return true;
  } catch (err) {
    console.error(
      `  Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/**
 * Get the config block as a formatted JSON string.
 */
export function getConfigBlock(creds: Credentials): string {
  const bentoConfig = getBentoConfig(creds, true);
  return JSON.stringify(
    {
      mcpServers: {
        bento: bentoConfig,
      },
    },
    null,
    2,
  );
}
