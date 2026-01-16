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
 * Get the OpenCode config file path.
 * macOS/Linux: ~/.config/opencode/config.json
 * Windows: %APPDATA%/opencode/config.json
 */
export function getConfigPath(): string {
  const home = homedir();
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode", "config.json");
  }
  return join(home, ".config", "opencode", "config.json");
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
 * Get the Bento MCP server configuration block for OpenCode.
 * OpenCode uses a different format than other MCP clients:
 * - Uses "mcp" instead of "mcpServers"
 * - Uses "type": "local"
 * - Uses "command" as an array
 * - Uses "environment" instead of "env"
 */
export function getBentoConfig(
  creds: Credentials,
  writeSecrets = false,
): object {
  if (writeSecrets) {
    return {
      type: "local",
      command: ["npx", "-y", "@bentonow/bento-mcp"],
      environment: {
        BENTO_PUBLISHABLE_KEY: creds.publishableKey,
        BENTO_SECRET_KEY: creds.secretKey,
        BENTO_SITE_UUID: creds.siteUuid,
      },
    };
  }

  // Reference env vars
  return {
    type: "local",
    command: ["npx", "-y", "@bentonow/bento-mcp"],
    environment: {
      BENTO_PUBLISHABLE_KEY: "${BENTO_PUBLISHABLE_KEY}",
      BENTO_SECRET_KEY: "${BENTO_SECRET_KEY}",
      BENTO_SITE_UUID: "${BENTO_SITE_UUID}",
    },
  };
}

/**
 * Configure Bento MCP for OpenCode by merging into the config file.
 */
export async function configure(
  creds: Credentials,
  options: ConfigureOptions = {},
): Promise<boolean> {
  const { dryRun = false, writeSecrets = true } = options;
  const configPath = getConfigPath();

  const bentoConfig = getBentoConfig(creds, writeSecrets);

  if (dryRun) {
    console.log("\n[OpenCode] Would modify:");
    console.log(`  ${configPath}`);
    console.log("\n  Adding mcp.bento:");
    console.log(
      `  ${JSON.stringify(bentoConfig, null, 2).split("\n").join("\n  ")}`,
    );
    return true;
  }

  console.log("\n[OpenCode] Configuring...");

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

    // Merge in bento config (OpenCode uses "mcp" not "mcpServers")
    if (!config.mcp) {
      config.mcp = {};
    }
    (config.mcp as Record<string, unknown>).bento = bentoConfig;

    // Write back
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

    // Validate by re-reading
    const written = await readFile(configPath, "utf-8");
    JSON.parse(written); // Will throw if invalid

    console.log(`  Updated: ${configPath}`);
    console.log("  Restart OpenCode to apply changes.");
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
      mcp: {
        bento: bentoConfig,
      },
    },
    null,
    2,
  );
}
