import { homedir, EOL } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile, readFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";

const isWindows = process.platform === "win32";

export interface Credentials {
  publishableKey: string;
  secretKey: string;
  siteUuid: string;
}

/**
 * Get the path to the Bento MCP environment file.
 * - macOS/Linux: ~/.bento/mcp/env
 * - Windows: %USERPROFILE%\.bento\mcp\env
 */
export function getEnvFilePath(): string {
  const home = homedir();
  return join(home, ".bento", "mcp", "env");
}

/**
 * Get the directory containing the env file.
 */
export function getEnvDir(): string {
  const home = homedir();
  return join(home, ".bento", "mcp");
}

/**
 * Save credentials to the secure env file.
 * Creates the directory with 0700 permissions if it doesn't exist.
 * On Windows, mode parameters are ignored (uses ACLs instead).
 */
export async function saveCredentials(creds: Credentials): Promise<void> {
  const dir = getEnvDir();
  const filePath = getEnvFilePath();

  // Create directory (with secure permissions on Unix)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true, ...(isWindows ? {} : { mode: 0o700 }) });
  }

  // Write credentials in shell-sourceable format (using platform line endings)
  const lines = [
    `BENTO_PUBLISHABLE_KEY=${creds.publishableKey}`,
    `BENTO_SECRET_KEY=${creds.secretKey}`,
    `BENTO_SITE_UUID=${creds.siteUuid}`,
    "", // trailing newline
  ];
  const content = lines.join(EOL);

  await writeFile(filePath, content, isWindows ? {} : { mode: 0o600 });

  // Ensure directory permissions on Unix (no-op on Windows)
  if (!isWindows) {
    await chmod(dir, 0o700);
    await chmod(filePath, 0o600);
  }
}

/**
 * Load existing credentials from the env file.
 * Returns null if the file doesn't exist or is invalid.
 * Handles both Unix (\n) and Windows (\r\n) line endings.
 */
export async function loadCredentials(): Promise<Credentials | null> {
  const filePath = getEnvFilePath();

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, "utf-8");
    // Split on \n and trim to handle both \n and \r\n line endings
    const lines = content.split(/\r?\n/);

    let publishableKey = "";
    let secretKey = "";
    let siteUuid = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("BENTO_PUBLISHABLE_KEY=")) {
        publishableKey = trimmed.slice("BENTO_PUBLISHABLE_KEY=".length);
      } else if (trimmed.startsWith("BENTO_SECRET_KEY=")) {
        secretKey = trimmed.slice("BENTO_SECRET_KEY=".length);
      } else if (trimmed.startsWith("BENTO_SITE_UUID=")) {
        siteUuid = trimmed.slice("BENTO_SITE_UUID=".length);
      }
    }

    if (publishableKey && secretKey && siteUuid) {
      return { publishableKey, secretKey, siteUuid };
    }

    return null;
  } catch {
    return null;
  }
}

