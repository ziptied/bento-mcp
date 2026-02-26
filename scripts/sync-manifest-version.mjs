import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const packageJsonPath = resolve(root, "package.json");
const manifestPath = resolve(root, "manifest.json");

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const pkgVersion = pkg.version;

if (!pkgVersion) {
  throw new Error("package.json is missing a version field.");
}

if (manifest.version !== pkgVersion) {
  manifest.version = pkgVersion;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated manifest version to ${pkgVersion}`);
} else {
  console.log("Manifest version already matches package.json");
}
