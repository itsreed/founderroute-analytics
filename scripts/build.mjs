import {mkdir,copyFile,readFile,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
async function copy(from,to){await mkdir(path.dirname(path.join(root,to)),{recursive:true});await copyFile(path.join(root,from),path.join(root,to));}
await copy("ios/Sources/FounderRouteAnalytics/FounderRouteAnalytics.swift","packages/react-native/ios/core/FounderRouteAnalytics.swift");
await copy("ios/Sources/FounderRouteAnalytics/PrivacyInfo.xcprivacy","packages/react-native/ios/core/PrivacyInfo.xcprivacy");
await copy("android/src/main/java/com/founderroute/analytics/FounderRouteAnalytics.kt","packages/react-native/android/src/main/java/com/founderroute/analytics/FounderRouteAnalytics.kt");
for(const name of ["browser","node","react-native"])await copy("LICENSE",`packages/${name}/LICENSE`);
const normalizeNewlines=(value)=>value.replace(/\r\n?/g,"\n");
const collection=normalizeNewlines(await readFile(path.join(root,"packages/browser/collection.js"),"utf8"));
const browser=normalizeNewlines(await readFile(path.join(root,"packages/browser/index.js"),"utf8"));
const version=JSON.parse(await readFile(path.join(root,"packages/browser/package.json"),"utf8")).version;
await mkdir(path.join(root,"dist",version),{recursive:true});
await writeFile(path.join(root,"dist",version,"analytics.js"),`(()=>{\n${collection.replaceAll("export ","")}\n${browser.replace('import { CollectionState } from "./collection.js";', "").replaceAll("export ","")}\nglobalThis.FounderRoute={init};\n})();\n`);

const release=JSON.parse(await readFile(path.join(root,"release.json"),"utf8"));
if(release.version!==version)throw new Error("Release manifest and browser version differ");
const artifactPaths=[`dist/${version}/analytics.js`,"contract/event-v1.schema.json","contract/event-v2.schema.json","contract/limits-v1.json"];
const integrity={};
for(const artifact of artifactPaths) integrity[artifact]=createHash("sha256").update(await readFile(path.join(root,artifact))).digest("hex");
const metadataCommit=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
let sourceCommit=metadataCommit;
try {
  sourceCommit=execFileSync("git",["rev-parse",`${release.tag}^{commit}`],{cwd:root,encoding:"utf8"}).trim();
  const artifactDrift=execFileSync("git",["diff","--name-only",`${sourceCommit}..HEAD`,"--","packages","android/src","android/build.gradle.kts","ios/Sources","Package.swift","contract","package.json","package-lock.json"],{cwd:root,encoding:"utf8"}).trim();
  if(artifactDrift)throw new Error(`Release artifacts differ from ${release.tag}: ${artifactDrift}`);
} catch(error) {
  if(release.published)throw error;
}
const sourceDirty=Boolean(execFileSync("git",["status","--porcelain","--","packages","android/src","ios/Sources","contract","scripts","release.json"],{cwd:root,encoding:"utf8"}).trim());
await writeFile(path.join(root,"dist",version,"release-manifest.json"),JSON.stringify({...release,sourceCommit,metadataCommit,sourceDirty,integrity},null,2)+"\n");
