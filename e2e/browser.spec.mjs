import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));

test('automatic collection has no UI and refusal survives tabs, reload and key rotation', {timeout:60000}, async () => {
  const events=[];
  const sdk=await readFile(new URL('../packages/browser/index.js',import.meta.url),'utf8');
  const collection=await readFile(new URL('../packages/browser/collection.js',import.meta.url),'utf8');
  const app=createServer(async(req,res)=>{
    if(req.url.startsWith('/api/analytics/v2/collect')) {
      let body='';for await(const chunk of req)body+=chunk;
      const batch=JSON.parse(body);events.push(...batch.events);
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({results:batch.events.map(e=>({event_id:e.event_id,status:'accepted'}))}));return;
    }
    if(req.url==='/sdk.js'||req.url==='/collection.js') {
      res.setHeader('Content-Type','text/javascript');res.end(req.url==='/sdk.js'?sdk:collection);return;
    }
    res.setHeader('Content-Type','text/html');
    res.end(`<main><h1>Customer application</h1></main><script type="module">
      import {init} from '/sdk.js';
      window.analytics=init({key:new URLSearchParams(location.search).get('key')??'fr_pk_original',endpoint:location.origin,propertyId:'automatic-fixture',environment:'test',collectionMode:'automatic'});
    </script>`);
  });
  const origin=await listen(app);let browser;
  try {
    browser=await chromium.launch();const context=await browser.newContext();
    const first=await context.newPage();await first.goto(origin);
    await first.waitForFunction(()=>window.analytics?.getDiagnostics().acknowledged>0);
    assert.ok(events.some(e=>e.name==='page_view'&&e.collection_mode==='automatic'&&e.consent_state==='not_provided'));
    assert.equal(await first.locator('body').innerText(),'Customer application');
    assert.equal(await first.locator('button,input,[role="dialog"],[role="alert"]').count(),0);
    const second=await context.newPage();await second.goto(origin);
    await second.waitForFunction(()=>window.analytics?.getDiagnostics().collectionEnabled);
    await first.evaluate(()=>analytics.optOut());
    await second.waitForFunction(()=>analytics.getDiagnostics().optedOut);
    assert.equal(await second.evaluate(()=>analytics.track('blocked')),null);
    await first.goto(origin+'?key=fr_pk_rotated');
    await first.waitForFunction(()=>Boolean(window.analytics));
    assert.equal(await first.evaluate(()=>analytics.getDiagnostics().optedOut),true);
    assert.equal(await first.evaluate(()=>analytics.getDiagnostics().anonymousId),null);
    assert.deepEqual(await first.evaluate(()=>Object.values(localStorage)),['refused']);
    await first.evaluate(()=>analytics.optIn());
    await first.waitForFunction(()=>analytics.getDiagnostics().collectionEnabled);
    // Clearing refusal elsewhere does not override the second tab's refusal.
    assert.equal(await second.evaluate(()=>analytics.getDiagnostics().collectionEnabled),false);
    await context.close();
  } finally {
    await browser?.close();app.closeAllConnections();await new Promise(r=>app.close(r));
  }
});
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
  const collection=await readFile(new URL('../packages/browser/collection.js',import.meta.url),'utf8');
  const customer=createServer((req,res)=>{
    if(req.url==='/collection.js'){res.setHeader('Content-Type','text/javascript');res.end(collection);return;}
    if(req.url==='/sdk.js'){res.setHeader('Content-Type','text/javascript');res.end(sdk);return;}
    res.setHeader('Content-Type','text/html');
    res.end(`<main><h1>Analytics installation fixture</h1><button id="route">Open feature</button></main><script type="module">
      import {init} from '/sdk.js';
      window.analytics=init({key:'fr_pk_browser_fixture',propertyId:'browser-fixture',environment:'test',collectionMode:'consent',endpoint:${JSON.stringify(endpoint)}});
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
    await page.evaluate(()=>analytics.setConsent(true));
    await page.waitForFunction(()=>analytics.getDiagnostics().lastError==='network_unavailable');
    const original=deliveries[0].event_id;
    assert.ok(await page.evaluate(()=>analytics.getDiagnostics().queued)>0);
    await page.reload();await page.waitForFunction(()=>Boolean(window.analytics));
    await page.evaluate(()=>analytics.setConsent(true));
    await page.waitForFunction(()=>analytics.getDiagnostics().queued===0);
    assert.ok(deliveries.filter(e=>e.event_id===original).length>=2);
    assert.equal([...accepted].filter(id=>id===original).length,1);
    await page.locator('#route').click();await page.evaluate(()=>analytics.flush());
    assert.ok(deliveries.some(e=>e.context.path==='/feature/[id]'));
    assert.equal(JSON.stringify(deliveries).includes('private@example.com'),false);
    await page.evaluate(()=>analytics.setConsent(false));
    const count=deliveries.length;
    await page.evaluate(async()=>{analytics.track('after_withdrawal');await analytics.flush();});
    assert.deepEqual(await page.evaluate(()=>Object.values(localStorage)),["refused"]);
    assert.equal(await page.evaluate(()=>analytics.getDiagnostics().anonymousId),null);
    assert.equal(deliveries.length,count);
    await context.close();
  } finally {
    await browser.close();
    await Promise.all([new Promise(r=>customer.close(r)),new Promise(r=>collector.close(r))]);
  }
});
