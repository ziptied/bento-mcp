import * as readline from "node:readline";
import { exec } from "node:child_process";
import {
  type Credentials,
  saveCredentials,
  loadCredentials,
  getEnvFilePath,
} from "./env.js";
import * as claudeCode from "./claude-code.js";
import * as claudeDesktop from "./claude-desktop.js";
import * as cursor from "./cursor.js";
import * as opencode from "./opencode.js";
import { printManualConfig, printConfigBlock } from "./manual.js";

const BENTO_API_SETTINGS_URL = "https://app.bentonow.com/account/teams";

type PromptOptions = {
  mask?: boolean;
};

export interface SetupOptions {
  client?: "claude-code" | "claude-desktop" | "cursor" | "opencode" | "all";
  yes?: boolean;
  dryRun?: boolean;
  print?: boolean;
  writeSecrets?: boolean;
}

type ClientType = "claude-code" | "claude-desktop" | "cursor" | "opencode" | "manual";

const CLIENT_NAMES: Record<ClientType, string> = {
  "claude-code": "Claude Code",
  "claude-desktop": "Claude Desktop",
  cursor: "Cursor",
  opencode: "OpenCode",
  manual: "Manual / Other",
};

/**
 * Create a readline interface for interactive prompts.
 */
function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt the user for input.
 */
async function prompt(
  rl: readline.Interface,
  question: string,
  options: PromptOptions = {},
): Promise<string> {
  const { mask = false } = options;

  if (!mask) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  return new Promise((resolve) => {
    const maskedRl = rl as readline.Interface & {
      _writeToOutput?: (stringToWrite: string) => void;
    };
    const originalFn = maskedRl._writeToOutput;
    const writer =
      originalFn ||
      function (stringToWrite: string): void {
        rl.output.write(stringToWrite);
      };

    maskedRl._writeToOutput = function (stringToWrite: string): void {
      if (
        typeof stringToWrite !== "string" ||
        stringToWrite.includes(question) ||
        stringToWrite.includes("\u001b")
      ) {
        writer.call(this, stringToWrite as string);
        return;
      }

      const normalized = stringToWrite.replace(/\r?\n/g, "");
      if (normalized.length === 0) {
        writer.call(this, stringToWrite);
        return;
      }

      writer.call(this, "*".repeat(normalized.length));
    };

    rl.question(question, (answer) => {
      if (originalFn) {
        maskedRl._writeToOutput = originalFn;
      } else {
        delete maskedRl._writeToOutput;
      }
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for a yes/no answer.
 */
async function promptYesNo(
  rl: readline.Interface,
  question: string,
  defaultYes = true,
): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = await prompt(rl, `${question} ${hint}: `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith("y");
}

/**
 * Open a URL in the default browser (cross-platform).
 */
function openUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    let command: string;
    switch (process.platform) {
      case "darwin":
        command = `open "${url}"`;
        break;
      case "win32":
        command = `start "" "${url}"`;
        break;
      default:
        command = `xdg-open "${url}"`;
    }
    exec(command, () => resolve());
  });
}

/**
 * Prompt for a credential with optional masking hint.
 */
async function promptCredential(
  rl: readline.Interface,
  name: string,
  envVar: string,
  existingValue?: string,
): Promise<string> {
  if (existingValue) {
    const masked =
      existingValue.length > 12
        ? `${existingValue.slice(0, 8)}...${existingValue.slice(-4)}`
        : "********";
    const answer = await prompt(
      rl,
      `${name} [${masked}] (press Enter to keep): `,
      { mask: true },
    );
    return answer || existingValue;
  }

  let value = "";
  while (!value) {
    value = await prompt(rl, `${name}: `, { mask: true });
    if (!value) {
      console.log(`  ${envVar} is required.`);
    }
  }
  return value;
}

/**
 * Prompt user to select MCP clients.
 */
async function promptClients(rl: readline.Interface): Promise<ClientType[]> {
  console.log("\nWhich MCP client(s) would you like to configure?");
  console.log("  1. Claude Code (recommended - uses CLI registration)");
  console.log("  2. Claude Desktop");
  console.log("  3. Cursor");
  console.log("  4. OpenCode");
  console.log("  5. Manual / Other (print config only)");
  console.log("  6. All of the above");
  console.log("");

  const answer = await prompt(
    rl,
    "Enter numbers separated by commas (e.g., 1,2): ",
  );

  const selections = answer
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s);

  const clients: ClientType[] = [];

  for (const sel of selections) {
    switch (sel) {
      case "1":
        clients.push("claude-code");
        break;
      case "2":
        clients.push("claude-desktop");
        break;
      case "3":
        clients.push("cursor");
        break;
      case "4":
        clients.push("opencode");
        break;
      case "5":
        clients.push("manual");
        break;
      case "6":
        return ["claude-code", "claude-desktop", "cursor", "opencode"];
      default:
        console.log(`  Unknown option: ${sel}`);
    }
  }

  return clients.length > 0 ? clients : ["manual"];
}

/**
 * Run the setup wizard.
 */
export async function runSetup(options: SetupOptions = {}): Promise<void> {
  const {
    client,
    yes = false,
    dryRun = false,
    print = false,
    writeSecrets = true,
  } = options;

  // Print-only mode
  if (print) {
    const creds = await loadCredentials();
    if (!creds) {
      const envCreds = getCredentialsFromEnv();
      if (envCreds) {
        printConfigBlock(envCreds);
        return;
      }
      console.error("No credentials found. Run setup without --print first.");
      process.exit(1);
    }
    printConfigBlock(creds);
    return;
  }

  console.log("");
  console.log("     ██████╗ ███████╗███╗   ██╗████████╗ ██████╗ ");
  console.log("     ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔═══██╗");
  console.log("     ██████╔╝█████╗  ██╔██╗ ██║   ██║   ██║   ██║");
  console.log("     ██╔══██╗██╔══╝  ██║╚██╗██║   ██║   ██║   ██║");
  console.log("     ██████╔╝███████╗██║ ╚████║   ██║   ╚██████╔╝");
  console.log("     ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ");
  console.log("");
  console.log("  MCP Server Setup");
  console.log("");
  console.log(
    "This wizard will help you configure Bento MCP for your AI assistant.",
  );
  console.log("");

  // Load existing credentials
  let creds = await loadCredentials();
  const envCreds = getCredentialsFromEnv();

  // Merge with environment variables (env takes precedence)
  if (envCreds) {
    creds = {
      publishableKey: envCreds.publishableKey || creds?.publishableKey || "",
      secretKey: envCreds.secretKey || creds?.secretKey || "",
      siteUuid: envCreds.siteUuid || creds?.siteUuid || "",
    };
  }

  // Determine which clients to configure
  let clients: ClientType[];

  if (yes) {
    // Non-interactive mode - validate credentials exist
    if (
      !creds ||
      !creds.publishableKey ||
      !creds.secretKey ||
      !creds.siteUuid
    ) {
      console.error(
        "Error: --yes requires credentials to be set via environment variables or existing config.",
      );
      console.error(
        "Set BENTO_PUBLISHABLE_KEY, BENTO_SECRET_KEY, and BENTO_SITE_UUID",
      );
      process.exit(1);
    }

    // Determine clients for non-interactive mode
    clients =
      client === "all"
        ? ["claude-code", "claude-desktop", "cursor", "opencode"]
        : client
          ? [client as ClientType]
          : ["claude-code", "claude-desktop", "cursor", "opencode"];

    // Save credentials
    if (!dryRun) {
      await saveCredentials(creds);
    }
  } else {
    // Interactive credential collection
    const rl = createRL();

    try {
      console.log("You'll need your Bento API credentials.");
      console.log("");

      const openBrowser = await promptYesNo(
        rl,
        "Open Bento API settings in your browser?",
        true,
      );

      if (openBrowser) {
        console.log(`\nOpening ${BENTO_API_SETTINGS_URL}...`);
        await openUrl(BENTO_API_SETTINGS_URL);
        console.log("");
      }

      console.log("Enter your credentials below:\n");
      console.log("(Input is hidden while you type.)\n");

      const publishableKey = await promptCredential(
        rl,
        "Publishable Key",
        "BENTO_PUBLISHABLE_KEY",
        creds?.publishableKey,
      );
      const secretKey = await promptCredential(
        rl,
        "Secret Key",
        "BENTO_SECRET_KEY",
        creds?.secretKey,
      );
      const siteUuid = await promptCredential(
        rl,
        "Site UUID",
        "BENTO_SITE_UUID",
        creds?.siteUuid,
      );

      creds = { publishableKey, secretKey, siteUuid };

      // Save credentials
      if (!dryRun) {
        await saveCredentials(creds);
        console.log(`\nCredentials saved to: ${getEnvFilePath()}`);
      } else {
        console.log(
          `\n[Dry Run] Would save credentials to: ${getEnvFilePath()}`,
        );
      }

      // Determine which clients to configure
      if (client) {
        clients =
          client === "all"
            ? ["claude-code", "claude-desktop", "cursor", "opencode"]
            : [client as ClientType];
      } else {
        clients = await promptClients(rl);
      }

      rl.close();
    } finally {
      rl.close();
    }
  }

  // Configure each client (creds is guaranteed to be set at this point)
  if (creds) {
    await configureClients(clients, creds, { dryRun, writeSecrets });
  }

  // Print summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("  Setup Complete");
  console.log("=".repeat(60));
  console.log("\nNext steps:");
  console.log("  1. Restart your MCP client(s) to load the new configuration");
  console.log(
    "  2. Ask your AI assistant to use a Bento tool (e.g., 'Get my Bento site stats')",
  );
  console.log(
    "\nFor more information, see: https://github.com/bentonow/bento-mcp",
  );
  console.log("");
}

/**
 * Get credentials from environment variables.
 */
function getCredentialsFromEnv(): Credentials | null {
  const publishableKey = process.env.BENTO_PUBLISHABLE_KEY;
  const secretKey = process.env.BENTO_SECRET_KEY;
  const siteUuid = process.env.BENTO_SITE_UUID;

  if (publishableKey || secretKey || siteUuid) {
    return {
      publishableKey: publishableKey || "",
      secretKey: secretKey || "",
      siteUuid: siteUuid || "",
    };
  }

  return null;
}

/**
 * Configure the selected MCP clients.
 */
async function configureClients(
  clients: ClientType[],
  creds: Credentials,
  options: { dryRun?: boolean; writeSecrets?: boolean },
): Promise<void> {
  const { dryRun = false, writeSecrets = true } = options;

  for (const clientType of clients) {
    console.log(`\nConfiguring ${CLIENT_NAMES[clientType]}...`);

    switch (clientType) {
      case "claude-code":
        await claudeCode.configure(creds, { dryRun });
        break;
      case "claude-desktop":
        await claudeDesktop.configure(creds, { dryRun, writeSecrets });
        break;
      case "cursor":
        await cursor.configure(creds, { dryRun, writeSecrets });
        break;
      case "opencode":
        await opencode.configure(creds, { dryRun, writeSecrets });
        break;
      case "manual":
        printManualConfig(creds);
        break;
    }
  }
}

/**
 * Parse CLI arguments for the setup command.
 */
export function parseSetupArgs(args: string[]): SetupOptions {
  const options: SetupOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--client": {
        const validClients = ["claude-code", "claude-desktop", "cursor", "opencode", "all"];
        const clientArg = args[++i];
        if (!clientArg || !validClients.includes(clientArg)) {
          console.error(
            `Invalid client: ${clientArg || "(missing)"}. Valid options: ${validClients.join(", ")}`,
          );
          process.exit(1);
        }
        options.client = clientArg as SetupOptions["client"];
        break;
      }
      case "--all":
        options.client = "all";
        break;
      case "--yes":
      case "-y":
        options.yes = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--print":
        options.print = true;
        break;
      case "--write-secrets":
        options.writeSecrets = true;
        break;
      case "--help":
      case "-h":
        printSetupHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Print help for the setup command.
 */
function printSetupHelp(): void {
  console.log(`
Bento MCP Setup

Usage: bento-mcp setup [options]

Options:
  --client <name>    Configure a specific client:
                     claude-code, claude-desktop, cursor, opencode
  --all              Configure all supported clients
  --yes, -y          Non-interactive mode (requires env vars)
  --dry-run          Show what would be done without making changes
  --print            Print the MCP config block and exit
  --write-secrets    Embed secrets directly in config files
  --help, -h         Show this help message

Examples:
  npx @bentonow/bento-mcp setup
  npx @bentonow/bento-mcp setup --client claude-code
  npx @bentonow/bento-mcp setup --client opencode
  npx @bentonow/bento-mcp setup --all --yes
  npx @bentonow/bento-mcp setup --dry-run
`);
}
