import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const release=JSON.parse(await readFile(new URL('../release.json',import.meta.url),'utf8'));
if(process.env.GITHUB_REF_TYPE!=='tag'||process.env.GITHUB_REF_NAME!==release.tag)throw new Error('Use the tested release tag');
if(!['next','latest'].includes(release.npmTag))throw new Error('Invalid release distribution tag');
for(const directory of ['browser','node','react-native']) {
  const result=spawnSync('npm',['publish',`./packages/${directory}`,'--access','public','--tag',release.npmTag],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
}
