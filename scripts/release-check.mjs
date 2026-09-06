import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseVersion = "0.1.0-beta.1";
const mavenVersion = "0.1.0-beta01";

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const packageFiles = [
  "package.json",
  "packages/browser/package.json",
  "packages/node/package.json",
  "packages/react-native/package.json",
];

for (const file of packageFiles) {
  const manifest = JSON.parse(await read(file));
  if (manifest.version !== releaseVersion) {
    throw new Error(`${file} has version ${manifest.version}; expected ${releaseVersion}`);
  }
}

const sourceVersions = [
  ["packages/browser/index.js", `VERSION = "${releaseVersion}"`],
  ["packages/node/index.js", `sdk_version:"${releaseVersion}"`],
  ["ios/Sources/FounderRouteAnalytics/FounderRouteAnalytics.swift", `"sdk_version": "${releaseVersion}"`],
  ["android/src/main/java/com/founderroute/analytics/FounderRouteAnalytics.kt", `"sdk_version","${releaseVersion}"`],
  ["android/build.gradle.kts", `version = "${mavenVersion}"`],
];

for (const [file, expected] of sourceVersions) {
  if (!(await read(file)).includes(expected)) {
    throw new Error(`${file} is not pinned to the release version`);
  }
}

if (process.env.GITHUB_REF_TYPE === "tag") {
  const expectedTag = `v${releaseVersion}`;
  if (process.env.GITHUB_REF_NAME !== expectedTag) {
    throw new Error(`Release tag must be ${expectedTag}`);
  }
}

console.log(`Release versions are aligned for ${releaseVersion}.`);
