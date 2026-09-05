import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
test('real browser consent, cross-origin delivery, lost acknowledgements and navigation', {timeout:60000}, async () => {
  const deliveries=[], accepted=new Set(); let loseAcknowledgement=true, customerOrigin='';
  const collector=createServer(async(req,res)=>{
    assert.equal(req.headers.origin,customerOrigin);
    res.setHeader('Access-Control-Allow-Origin',customerOrigin);
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    let body='';for await(const chunk of req) body+=chunk;
    const batch=JSON.parse(body);
    const results=batch.events.map(e=>{deliveries.push(e);const duplicate=accepted.has(e.event_id);accepted.add(e.event_id);return {event_id:e.event_id,status:duplicate?'duplicate':'accepted'};});
    // An interrupted receipt body cannot be mistaken for an acknowledgement or transparently retried by Chromium.
    if(loseAcknowledgement){loseAcknowledgement=false;res.setHeader('Content-Type','application/json');res.end('{');return;}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({results}));
  });
  const endpoint=await listen(collector);
  const sdk=await readFile(new URL('../packages/browser/index.js',import.meta.url),'utf8');
  const customer=createServer((req,res)=>{
    if(req.url==='/sdk.js'){res.setHeader('Content-Type','text/javascript');res.end(sdk);return;}
    res.setHeader('Content-Type','text/html');
    res.end(`<main><h1>Analytics installation fixture</h1><button id="allow">Allow analytics</button><button id="deny">Withdraw consent</button><button id="route">Open feature</button></main><script type="module">
      import {init} from '/sdk.js';
      window.analytics=init({key:'fr_pk_browser_fixture',endpoint:${JSON.stringify(endpoint)}});
      document.querySelector('#allow').onclick=()=>analytics.setConsent(true);
      document.querySelector('#deny').onclick=()=>analytics.setConsent(false);
      document.querySelector('#route').onclick=()=>history.pushState({},'', '/feature/123?email=private@example.com#secret');
    </script>`);
  });
  customerOrigin=await listen(customer);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext();const page=await context.newPage();
    await page.goto(customerOrigin);await page.waitForFunction(()=>Boolean(window.analytics));
    await page.evaluate(()=>analytics.track('must_not_exist'));
    assert.equal(await page.evaluate(()=>localStorage.length),0);
    assert.equal(deliveries.length,0);
    await page.locator('#allow').click();
    await page.waitForFunction(()=>analytics.getDiagnostics().lastError==='network_unavailable');
    const original=deliveries[0].event_id;
    assert.ok(await page.evaluate(()=>analytics.getDiagnostics().queued)>0);
    await page.reload();await page.waitForFunction(()=>Boolean(window.analytics));
    await page.locator('#allow').click();
    await page.waitForFunction(()=>analytics.getDiagnostics().queued===0);
    assert.ok(deliveries.filter(e=>e.event_id===original).length>=2);
    assert.equal([...accepted].filter(id=>id===original).length,1);
    await page.locator('#route').click();await page.evaluate(()=>analytics.flush());
    assert.ok(deliveries.some(e=>e.context.path==='/feature/[id]'));
    assert.equal(JSON.stringify(deliveries).includes('private@example.com'),false);
    await page.locator('#deny').click();
    const count=deliveries.length;
    await page.evaluate(async()=>{analytics.track('after_withdrawal');await analytics.flush();});
    assert.equal(await page.evaluate(()=>localStorage.length),0);
    assert.equal(await page.evaluate(()=>analytics.getDiagnostics().anonymousId),null);
    assert.equal(deliveries.length,count);
    await context.close();
  } finally {
    await browser.close();
    await Promise.all([new Promise(r=>customer.close(r)),new Promise(r=>collector.close(r))]);
  }
});
