import type { Credentials } from "./env.js";
import { getEnvFilePath } from "./env.js";

/**
 * Print configuration for manual setup.
 * Used when the user selects "Manual / Other" or when other methods fail.
 */
export function printManualConfig(creds: Credentials): void {
  const envPath = getEnvFilePath();

  console.log(`\n${"=".repeat(60)}`);
  console.log("Manual Configuration");
  console.log("=".repeat(60));

  console.log("\n1. Environment Variables");
  console.log("-".repeat(40));
  console.log(`Your credentials are stored in: ${envPath}`);
  console.log("\nTo source them in your shell:");
  console.log(`  source ${envPath}`);
  console.log("\nOr set these environment variables:");
  console.log(`  BENTO_PUBLISHABLE_KEY=${creds.publishableKey}`);
  console.log(`  BENTO_SECRET_KEY=${creds.secretKey}`);
  console.log(`  BENTO_SITE_UUID=${creds.siteUuid}`);

  console.log("\n2. MCP Server Configuration");
  console.log("-".repeat(40));
  console.log("Add this to your MCP client's configuration:");
  console.log(`
{
  "mcpServers": {
    "bento": {
      "command": "npx",
      "args": ["-y", "@bentonow/bento-mcp"],
      "env": {
        "BENTO_PUBLISHABLE_KEY": "${creds.publishableKey}",
        "BENTO_SECRET_KEY": "${creds.secretKey}",
        "BENTO_SITE_UUID": "${creds.siteUuid}"
      }
    }
  }
}`);

  console.log("\n3. Testing");
  console.log("-".repeat(40));
  console.log("Run the server directly to test:");
  console.log(`  BENTO_PUBLISHABLE_KEY=${creds.publishableKey} \\`);
  console.log(`  BENTO_SECRET_KEY=${creds.secretKey} \\`);
  console.log(`  BENTO_SITE_UUID=${creds.siteUuid} \\`);
  console.log("  npx @bentonow/bento-mcp");

  console.log(`\n${"=".repeat(60)}`);
}

/**
 * Print just the JSON config block (for --print flag).
 */
export function printConfigBlock(creds: Credentials): void {
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          bento: {
            command: "npx",
            args: ["-y", "@bentonow/bento-mcp"],
            env: {
              BENTO_PUBLISHABLE_KEY: creds.publishableKey,
              BENTO_SECRET_KEY: creds.secretKey,
              BENTO_SITE_UUID: creds.siteUuid,
            },
          },
        },
      },
      null,
      2,
    ),
  );
}
