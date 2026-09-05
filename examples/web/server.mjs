import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const html=fileURLToPath(new URL('./index.html',import.meta.url));
const sdk=fileURLToPath(new URL('../../packages/browser/index.js',import.meta.url));
createServer(async(req,res)=>{
  try{
    if(req.url==='/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({key:process.env.FOUNDERROUTE_PUBLIC_KEY,endpoint:process.env.FOUNDERROUTE_ORIGIN}));return;}
    if(req.url==='/sdk.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(sdk));return;}
    res.setHeader('Content-Type','text/html');res.end(await readFile(html));
  }catch{res.writeHead(500);res.end('Example could not load.');}
}).listen(4318,'127.0.0.1',()=>console.log('Open http://127.0.0.1:4318 and register this origin on your test property.'));
