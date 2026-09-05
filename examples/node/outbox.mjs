import {readFile,writeFile,rename} from 'node:fs/promises';
import {FounderRouteServer} from '../../packages/node/index.js';
const path=process.env.FOUNDERROUTE_OUTBOX_FILE;
if(!path)throw new Error('Set FOUNDERROUTE_OUTBOX_FILE to your application-owned durable outbox JSON file.');
const client=new FounderRouteServer({secret:process.env.FOUNDERROUTE_SECRET,endpoint:process.env.FOUNDERROUTE_ORIGIN});
// A single-consumer example. Your application inserts the exact event and stable IDs
// atomically with its successful business transaction. Never regenerate IDs here.
const queued=JSON.parse(await readFile(path,'utf8'));
const receipt=await client.send(queued.slice(0,50));
const acknowledged=new Set(receipt.results.filter(r=>['accepted','duplicate','rejected'].includes(r.status)).map(r=>r.event_id));
await writeFile(path+'.tmp',JSON.stringify(queued.filter(e=>!acknowledged.has(e.event_id))));
await rename(path+'.tmp',path);
console.log({acknowledged:acknowledged.size,rejected:receipt.results.filter(r=>r.status==='rejected').length});
