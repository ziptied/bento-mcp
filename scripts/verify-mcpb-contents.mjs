import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const bundleArg = process.argv[2] || "bento-mcp.mcpb";
const bundlePath = resolve(process.cwd(), bundleArg);

if (!existsSync(bundlePath)) {
  console.error(`Bundle not found: ${bundlePath}`);
  process.exit(1);
}

function listArchiveEntries(zipPath) {
  try {
    const output = execFileSync("unzip", ["-Z1", zipPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error("Failed to read bundle contents with `unzip -Z1`.");
    console.error(String(error));
    process.exit(1);
  }
}

const entries = listArchiveEntries(bundlePath);

const requiredPaths = [
  "manifest.json",
  "package.json",
  "build/index.js",
  "node_modules/@bentonow/bento-node-sdk/package.json",
  "node_modules/@modelcontextprotocol/sdk/package.json",
  "node_modules/zod/package.json",
];

const allowedPatterns = [
  /^manifest\.json$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^README\.md$/,
  /^LICENSE$/,
  /^build\/.+/,
  /^node_modules\/.+/,
];

const blockedPatterns = [
  /^\.claude\//,
  /^\.git\//,
  /^docs\//,
  /^src\//,
  /^scripts\//,
  /^PLANS\.md$/,
  /^BENTO_MCP_SETUP_SPEC\.md$/,
  /^node_modules\/\.bin\//,
  /^node_modules\/\.package-lock\.json$/,
  /^node_modules\/\.yarn-integrity$/,
  /^node_modules\/@biomejs\//,
  /^node_modules\/@esbuild\//,
  /^node_modules\/@types\//,
  /^node_modules\/esbuild\//,
  /^node_modules\/typescript\//,
];

const missingRequired = requiredPaths.filter((requiredPath) => {
  return !entries.includes(requiredPath);
});

const blockedFound = entries.filter((entry) => {
  return blockedPatterns.some((pattern) => pattern.test(entry));
});

const unexpected = entries.filter((entry) => {
  return !allowedPatterns.some((pattern) => pattern.test(entry));
});

if (
  missingRequired.length > 0 ||
  blockedFound.length > 0 ||
  unexpected.length > 0
) {
  console.error("mcpb bundle content validation failed.");

  if (missingRequired.length > 0) {
    console.error("\nMissing required entries:");
    for (const item of missingRequired) {
      console.error(`- ${item}`);
    }
  }

  if (blockedFound.length > 0) {
    console.error("\nBlocked entries found:");
    for (const item of blockedFound) {
      console.error(`- ${item}`);
    }
  }

  if (unexpected.length > 0) {
    console.error("\nUnexpected entries found:");
    for (const item of unexpected) {
      console.error(`- ${item}`);
    }
  }

  process.exit(1);
}

console.log(
  `Bundle contents validated (${entries.length} files): ${bundleArg}`,
);
