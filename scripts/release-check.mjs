import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const release = JSON.parse(await readFile(path.join(root,"release.json"),"utf8"));
const releaseVersion = release.version;
const mavenVersion = release.maven.version;

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

if (process.env.REQUIRE_RELEASE_TAG === "true" && process.env.GITHUB_REF_TYPE !== "tag") {
  throw new Error("Publication must be dispatched against the tested release tag.");
}
if (process.env.GITHUB_REF_TYPE === "tag") {
  const expectedTag = `v${releaseVersion}`;
  if (process.env.GITHUB_REF_NAME !== expectedTag) {
    throw new Error(`Release tag must be ${expectedTag}`);
  }
}

for (const [canonical, embedded] of [
  ["ios/Sources/FounderRouteAnalytics/FounderRouteAnalytics.swift", "packages/react-native/ios/core/FounderRouteAnalytics.swift"],
  ["android/src/main/java/com/founderroute/analytics/FounderRouteAnalytics.kt", "packages/react-native/android/src/main/java/com/founderroute/analytics/FounderRouteAnalytics.kt"],
]) {
  if (await read(canonical) !== await read(embedded)) throw new Error(`Generated native source drift: ${embedded}`);
}
console.log(`Release versions are aligned for ${releaseVersion}.`);
