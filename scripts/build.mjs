import {mkdir,copyFile,readFile,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
async function copy(from,to){await mkdir(path.dirname(path.join(root,to)),{recursive:true});await copyFile(path.join(root,from),path.join(root,to));}
await copy("ios/Sources/FounderRouteAnalytics/FounderRouteAnalytics.swift","packages/react-native/ios/core/FounderRouteAnalytics.swift");
await copy("ios/Sources/FounderRouteAnalytics/PrivacyInfo.xcprivacy","packages/react-native/ios/core/PrivacyInfo.xcprivacy");
await copy("android/src/main/java/com/founderroute/analytics/FounderRouteAnalytics.kt","packages/react-native/android/src/main/java/com/founderroute/analytics/FounderRouteAnalytics.kt");
for(const name of ["browser","node","react-native"])await copy("LICENSE",`packages/${name}/LICENSE`);
const browser=await readFile(path.join(root,"packages/browser/index.js"),"utf8");
const version=JSON.parse(await readFile(path.join(root,"packages/browser/package.json"),"utf8")).version;
await mkdir(path.join(root,"dist",version),{recursive:true});
await writeFile(path.join(root,"dist",version,"analytics.js"),`(()=>{\n${browser.replaceAll("export ","")}\nglobalThis.FounderRoute={init};\n})();\n`);
