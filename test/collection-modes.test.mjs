import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FounderRouteAnalytics } from '../packages/browser/index.js';
import { createBridge } from '../packages/react-native/bridge.js';
import { FounderRouteServer } from '../packages/node/index.js';

test('server permission is scoped to each outcome and preserves legacy callers', () => {
  const server = new FounderRouteServer({secret:'fr_sk_fixture',endpoint:'https://collector.example'});
  const subject = {userId:'u1',anonymousId:'a1'};
  const automatic = server.event('signup_completed',{...subject,collectionMode:'automatic'});
  assert.equal(automatic.consent_state,'not_provided');assert.equal('consent' in automatic,false);
  assert.equal(server.event('signup_completed',{...subject,collectionMode:'automatic',optedOut:true}),null);
  assert.equal(server.event('signup_completed',{...subject,collectionMode:'consent'}),null);
  assert.equal(server.event('signup_completed',{...subject,consent:true}).protocol,1);
  assert.equal(server.event('signup_completed',{...subject,collectionMode:'automatic'}).protocol,2);
});

function fixture(extra = {}) {
  const data = new Map();
  const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const options = { key:'fr_pk_test', endpoint:'https://collector.example', propertyId:'property-a', environment:'test', collectionMode:'automatic', autoPage:false, storage,
    fetch: async (_url,request) => new Response(JSON.stringify({results: JSON.parse(request.body).events.map(e => ({event_id:e.event_id,status:'accepted'}))})), ...extra };
  return {data, options, client:new FounderRouteAnalytics(options)};
}

test('automatic collection emits protocol 2 without asserting consent', () => {
  const {client} = fixture();
  assert.ok(client.track('value'));
  assert.equal(client.queue[0].protocol,2);
  assert.equal(client.queue[0].collection_mode,'automatic');
  assert.equal(client.queue[0].consent_state,'not_provided');
  assert.equal('consent' in client.queue[0],false);
  client.destroy();
});

test('refusal persists across reload, key rotation, resets and mode changes', () => {
  const {client,options,data} = fixture();
  client.track('pending'); client.optOut(); client.reset(); client.setCollectionMode('automatic');
  assert.equal(client.track('blocked'),null);
  assert.deepEqual([...data.values()],['refused']);
  client.destroy();
  const next = new FounderRouteAnalytics({...options,key:'fr_pk_rotated'});
  assert.equal(next.track('still_blocked'),null);
  next.optIn(); assert.ok(next.track('resumed'));
  assert.equal(next.queue[0].consent_state,'not_provided'); next.destroy();
});

test('consent opt-in alone does not grant permission, and queued metadata is immutable', () => {
  const {client} = fixture({collectionMode:'consent'});
  client.optIn(); assert.equal(client.track('blocked'),null);
  client.setConsent(true); client.track('granted');
  client.setCollectionMode('automatic');
  assert.equal(client.queue[0].collection_mode,'consent');
  assert.equal(client.queue[0].consent_state,'granted');
  client.setConsent(false); assert.equal(client.getDiagnostics().queued,0); client.destroy();
});

test('destroy preserves pending delivery without recording refusal', () => {
  const {client,options,data} = fixture(); const id = client.track('offline'); client.destroy();
  assert.equal([...data.values()].includes('refused'),false);
  const next = new FounderRouteAnalytics({...options,fetch:async()=>{throw new Error('offline');}});
  assert.equal(next.queue[0].event_id,id); next.destroy();
});

test('configuration lookup preserves legacy consent mode and failure stays paused', async () => {
  const {client} = fixture({collectionMode:undefined,fetch:async()=>new Response(JSON.stringify({property_id:'property-a',environment:'test',collection_mode:'consent'}))});
  await client.ready; assert.equal(client.getDiagnostics().collectionMode,'consent'); assert.equal(client.track('blocked'),null);client.destroy();
  const bad = fixture({collectionMode:undefined,fetch:async()=>{throw new Error('offline');}}).client;
  await bad.ready;assert.equal(bad.track('blocked'),null);assert.equal(bad.getDiagnostics().lastError,'configuration_unavailable');bad.destroy();
});

test('late response bodies cannot restore withdrawn events or counters', async () => {
  let finish;
  const {client} = fixture({fetch:async()=>({ok:true,status:200,json:()=>new Promise(resolve=>{finish=resolve;})})});
  const id=client.track('value'); const delivery=client.flush();
  await Promise.resolve(); client.optOut(); finish({results:[{event_id:id,status:'accepted'}]}); await delivery;
  assert.equal(client.getDiagnostics().queued,0);assert.equal(client.getDiagnostics().acknowledged,0);assert.equal(client.getDiagnostics().anonymousId,null);client.destroy();
});

test('storage failure preserves the in-memory refusal and reports its limitation', () => {
  const {client}=fixture({storage:{getItem:()=>{throw Error();},setItem:()=>{throw Error();},removeItem:()=>{throw Error();}}});
  client.optOut();assert.equal(client.track('blocked'),null);assert.equal(client.getDiagnostics().lastError,'preference_storage_unavailable');client.destroy();
});


test('legacy deliveries retain their IDs and protocol during queue migration', () => {
  const data = new Map();
  const legacy = {event_id:'legacy-event',protocol:1,consent:true,occurred_at:new Date().toISOString(),name:'value'};
  data.set('founderroute:fr_pk_test',JSON.stringify({identity:'legacy-identity',queue:[legacy]}));
  const storage = {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const {client}=fixture({storage,collectionMode:'consent',fetch:async()=>{throw Error('offline');}});
  assert.equal(client.getDiagnostics().queued,0);
  client.setConsent(true);
  assert.equal(client.queue[0].event_id,'legacy-event');assert.equal(client.queue[0].protocol,1);
  assert.equal(data.has('founderroute:fr_pk_test'),false);client.destroy();
});

test('persisted refusal removes legacy queued data without collecting it', () => {
  const data = new Map([
    ['founderroute:property-a:test:preference','refused'],
    ['founderroute:fr_pk_test',JSON.stringify({identity:'old',queue:[]})]
  ]);
  const storage = {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const {client}=fixture({storage});assert.equal(client.track('blocked'),null);
  assert.deepEqual([...data.values()],['refused']);client.destroy();
});

test('mode changes cannot bypass unresolved property configuration', async () => {
  let resolve;
  const {client}=fixture({propertyId:undefined,collectionMode:undefined,fetch:()=>new Promise(r=>{resolve=r;})});
  client.setCollectionMode('automatic');assert.equal(client.track('blocked'),null);
  resolve(new Response(JSON.stringify({property_id:'property-a',environment:'test',collection_mode:'consent'})));
  await client.ready;assert.equal(client.track('still_paused'),null);client.destroy();
});


test('React Native forwards mode, stable property scope and privacy controls', () => {
  const calls=[];
  const native=new Proxy({}, {get:(_,name)=>(...args)=>calls.push({name,args})});
  const client=createBridge(native,'ios',{endpoint:'https://collector.example',collectionMode:'automatic',ios:{key:'fr_pk_test',appId:'example.app',propertyId:'property-a',environment:'test'}});
  assert.deepEqual(calls[0].args.slice(-3),['automatic','property-a','test']);
  client.optOut();client.optIn();client.setCollectionMode('consent');client.destroy();
  assert.deepEqual(calls.slice(1).map(call=>call.name),['optOut','optIn','setCollectionMode','destroy']);
});
