import {test} from "node:test";
import assert from "node:assert/strict";
import {FounderRouteAnalytics,normalizePath} from "../packages/browser/index.js";
import {FounderRouteServer,signIdentity} from "../packages/node/index.js";
import {createBridge} from "../packages/react-native/bridge.js";

function setup(fetch){
  const data=new Map();let reads=0,writes=0;
  const storage={getItem:k=>{reads++;return data.get(k)},setItem:(k,v)=>{writes++;data.set(k,v)},removeItem:k=>data.delete(k)};
  const client=new FounderRouteAnalytics({key:"fr_pk_fixture_key",endpoint:"https://collector.example",autoPage:false,storage,fetch,allowedTraits:["role"],allowedProperties:["feature"]});
  return {client,data,storage,counts:()=>({reads,writes})};
}
const ack=async(_url,request)=>new Response(JSON.stringify({results:JSON.parse(request.body).events.map(e=>({event_id:e.event_id,status:"accepted"}))}));
test("denied consent does not read storage, create identity, buffer, or transmit",async()=>{
  let sent=0;const {client,counts}=setup(async()=>{sent++;return ack()});
  client.track("before");client.identify("user");client.page("/private");await client.flush();
  assert.deepEqual(counts(),{reads:0,writes:0});assert.equal(sent,0);assert.equal(client.getDiagnostics().anonymousId,null);assert.equal(client.getDiagnostics().queued,0);
});
test("missing acknowledgement retains event IDs through restart, then removes acknowledged deliveries",async()=>{
  const captured=[];const {client,storage}=setup(async(_url,request)=>{captured.push(JSON.parse(request.body));throw new Error("offline")});
  client.setConsent(true);const id=client.track("published",{feature:"editor"},{outcomeId:"operation-1"});await client.flush();
  assert.equal(client.getDiagnostics().queued,1);
  const restarted=new FounderRouteAnalytics({key:client.options.key,endpoint:client.endpoint,autoPage:false,storage,fetch:async(url,request)=>{captured.push(JSON.parse(request.body));return ack(url,request)}});
  restarted.setConsent(true);await restarted.flush();assert.equal(captured[1].events[0].event_id,id);assert.equal(restarted.getDiagnostics().queued,0);
  client.destroy();restarted.destroy();
});
test("partial receipts preserve unknown deliveries, withdrawal clears all local state",async()=>{
  const {client,data}=setup(async(_url,request)=>{const [first]=JSON.parse(request.body).events;return new Response(JSON.stringify({results:[{event_id:first.event_id,status:"duplicate"}]}))});
  client.setConsent(true);client.track("one");client.track("two");await client.flush();assert.equal(client.getDiagnostics().queued,1);
  client.setConsent(false);assert.equal(data.size,0);assert.equal(client.getDiagnostics().anonymousId,null);assert.equal(client.getDiagnostics().queued,0);
});
test("queued identities remain fixed across logout and account switching",()=>{
  const {client}=setup(ack);client.setConsent(true);client.identify("first",{traits:{role:"founder",email:"redacted"}});client.setAccount("account-a");client.track("published");client.reset();client.identify("second");client.track("published");
  const outcomes=client.queue.filter(e=>e.name==="published");assert.equal(outcomes[0].user_id,"first");assert.equal(outcomes[0].account_id,"account-a");assert.equal(outcomes[1].account_id,undefined);assert.notEqual(outcomes[0].anonymous_id,outcomes[1].anonymous_id);assert.equal(outcomes[0].traits.email,undefined);client.destroy();
});
test("browser queue is bounded and routes omit sensitive URL fields",()=>{
  const {client}=setup(ack);client.setConsent(true);for(let i=0;i<1002;i++)client.track("event");assert.equal(client.getDiagnostics().queued,1000);assert.equal(client.getDiagnostics().dropped,2);assert.equal(normalizePath("/users/123?email=a@example.com#secret"),"/users/[id]");client.destroy();
});
test("Node outcomes require consent and retain business operation and event IDs",async()=>{
  let sent=0;const server=new FounderRouteServer({secret:"fr_sk_test_secret",endpoint:"https://collector.example",fetch:async(u,r)=>{sent++;return ack(u,r)}});
  assert.equal(server.event("signup_completed",{consent:false}),null);await server.send([null]);assert.equal(sent,0);
  const event=server.event("signup_completed",{consent:true,userId:"u1",anonymousId:"a1",outcomeId:"signup:u1"});assert.equal(event.outcome_id,"signup:u1");await server.send([event]);assert.equal(sent,1);
  const token=signIdentity({secret:server.secret,propertyId:"property",userId:"u1"});assert.equal(JSON.parse(Buffer.from(token.split(".")[0],"base64url")).user_id,"u1");
});
test("React Native forwards consent and screen tracking once to the selected native property",()=>{
  const calls=[];const native=new Proxy({}, {get:(_,name)=>(...args)=>calls.push({name,args})});
  const bridge=createBridge(native,"ios",{endpoint:"https://collector.example",ios:{key:"ios-key",appId:"example.ios"},android:{key:"android-key",appId:"example.android"}});
  assert.equal(calls.length,1);assert.equal(calls[0].args[0],"ios-key");bridge.setConsent(false);bridge.screen("Editor");assert.deepEqual(calls.map(c=>c.name),["configure","setConsent","screen"]);
});
