import { CollectionState } from "./collection.js";
const VERSION = "1.0.0-rc.2";
const MAX_BYTES = 1024 * 1024;
const MAX_EVENTS = 1000;
const TTL = 86400000;
const encoder = new TextEncoder();
const sensitive = /password|secret|token|email|phone|authorization|credit.?card|address|full.?name/i;
const uuid = () => globalThis.crypto.randomUUID();
const clean = (properties, allowed = []) => Object.fromEntries(Object.entries(properties ?? {}).filter(([k,v]) => allowed.includes(k) && !sensitive.test(k) && (v === null || ["string","boolean","number"].includes(typeof v))).map(([k,v]) => [k,typeof v === "string" ? v.slice(0,500) : v]));
export function normalizePath(value) {
  return String(value ?? "/").split(/[?#]/)[0].split("/").map(s => /^\d+$/.test(s) || /@|%40/i.test(s) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s) ? "[id]" : s).join("/").slice(0,500);
}

export class FounderRouteAnalytics {
  constructor(options) {
    if (!options?.key || !options?.endpoint) throw new Error("FounderRoute requires a public key and collector origin.");
    this.options = options; this.endpoint = options.endpoint.replace(/\/$/, "");
    this.configurationReady = false; this.storageKey = `founderroute:${options.key}`; this.collecting = false; this.queue = [];
    this.identity = null; this.session = null; this.user = null; this.account = null; this.token = null; this.traits = {};
    this.dropped = 0; this.rejected = 0; this.sent = 0; this.lastError = null; this.inFlight = null; this.retryAt = 0; this.failures = 0;
    this.generation = 0; this.cleanups = []; this.timer = null; this.lastInteraction = 0; this.lastTick = 0; this.lastPage = null;
    this.collection = new CollectionState({
      mode: null, preferenceKey: `founderroute:${options.key}:preference`,
      storage: () => options.storage ?? globalThis.localStorage,
      error: reason => { this.lastError = reason; }, changed: () => this.reconcileCollection(),
    });
    this.preferenceListener = event => {
      if (event.key === this.collection.preferenceKey && event.newValue === 'refused') this.collection.receiveRefusal();
    };
    globalThis.addEventListener?.('storage', this.preferenceListener);
    if (options.propertyId && ['production','test'].includes(options.environment) && options.collectionMode) {
      this.configureCollection(options.propertyId, options.environment, options.collectionMode);
      this.ready = Promise.resolve();
    } else {
      this.ready = this.resolveConfiguration();
    }
  }
  setConsent(granted) { this.collection.setConsent(Boolean(granted)); }
  optOut() { this.collection.optOut(); }
  optIn() { this.collection.optIn(); }
  setCollectionMode(mode) { this.collection.setMode(mode); }
  async resolveConfiguration() {
    try {
      const response = await (this.options.fetch ?? globalThis.fetch)(`${this.endpoint}/api/analytics/v2/config?key=${encodeURIComponent(this.options.key)}`);
      if (!response.ok) throw new Error('Configuration unavailable');
      const config = await response.json();
      if (!config.property_id || !['production','test'].includes(config.environment) || !['automatic','consent'].includes(config.collection_mode)) throw new Error('Invalid configuration');
      if (this.collection.destroyed) return;
      this.configureCollection(config.property_id, config.environment, this.options.collectionMode ?? config.collection_mode);
    } catch { this.lastError = 'configuration_unavailable'; }
  }
  configureCollection(propertyId, environment, mode) {
    this.propertyId = propertyId; this.environment = environment;
    this.storageKey = `founderroute:${propertyId}:${environment}:events`;
    this.collection.preferenceKey = `founderroute:${propertyId}:${environment}:preference`;
    const refusedHere = this.collection.refused;
    this.collection.refresh();
    if (refusedHere) this.collection.saveRefusal(true);
    this.configurationReady = true;
    this.collection.setMode(mode);
  }
  reconcileCollection() {
    const granted = this.configurationReady && this.collection.enabled;
    if (!granted && this.collection.refused) {
      try { const storage = this.options.storage ?? globalThis.localStorage; storage?.removeItem(this.storageKey); storage?.removeItem(`founderroute:${this.options.key}`); }
      catch { /* preference persistence reports storage failure separately */ }
    }
    if (granted === this.collecting) return;
    this.collecting = granted; this.generation++;
    if (!this.collecting) {
      this.controller?.abort(); this.inFlight = null; clearInterval(this.timer); this.timer = null;
      for (const remove of this.cleanups.splice(0)) remove();
      this.queue = []; this.identity = null; this.session = null; this.user = null; this.token = null; this.account = null; this.traits = {}; this.lastPage = null;
      try { const storage = this.options.storage ?? globalThis.localStorage; storage?.removeItem(this.storageKey); storage?.removeItem(`founderroute:${this.options.key}`); } catch { /* unavailable storage is not fatal */ }
      return;
    }
    try {
      const storage = this.options.storage ?? globalThis.localStorage;
      const stored = storage?.getItem(this.storageKey) ?? storage?.getItem(`founderroute:${this.options.key}`);
      if (stored) { const saved = JSON.parse(stored); this.queue = Array.isArray(saved.queue) ? saved.queue : []; this.identity = saved.identity; }
    } catch { this.queue = []; }
    this.identity ||= uuid(); this.lastInteraction = Date.now(); this.lastTick = Date.now();
    this.prune(); this.persist();
    try { const storage = this.options.storage ?? globalThis.localStorage; if (storage?.getItem(this.storageKey)) storage.removeItem(`founderroute:${this.options.key}`); } catch { /* keep legacy delivery if migration did not persist */ }
    this.attach();
    this.timer = setInterval(() => { this.engagement(); void this.flush(); }, 15000);
    this.timer?.unref?.();
    if (this.options.autoPage !== false && globalThis.location) this.page();
    void this.flush();
  }
  persist() {
    if (!this.collecting) return;
    try { (this.options.storage ?? globalThis.localStorage)?.setItem(this.storageKey, JSON.stringify({ identity:this.identity,queue:this.queue })); }
    catch { this.lastError = "storage_unavailable"; }
  }
  prune() {
    const now = Date.now();
    const keep = this.queue.filter(e => now-Date.parse(e.occurred_at) <= TTL);
    this.dropped += this.queue.length-keep.length; this.queue = keep;
    while (this.queue.length>MAX_EVENTS || encoder.encode(JSON.stringify(this.queue)).length>MAX_BYTES) { this.queue.shift(); this.dropped++; }
  }
  event(name, properties = {}, extra = {}) {
    if (!this.collecting) return null;
    const now = Date.now();
    if (!this.session || now-this.session.last >= 1800000) this.session = { id:uuid(),last:now };
    this.session.last = now;
    const event = {
      event_id:uuid(),protocol:2,name,kind:extra.kind ?? "custom",occurred_at:new Date(now).toISOString(),anonymous_id:this.identity,
      ...(this.user ? {user_id:this.user} : {}),...(this.token ? {identity_token:this.token} : {}),...(this.account ? {account_id:this.account} : {}),
      session_id:this.session.id,...this.collection.metadata(),properties:clean(properties,this.options.allowedProperties),traits:clean(this.traits,this.options.allowedTraits),
      context:{sdk:"browser",sdk_version:VERSION,...(this.options.verificationId?{verification_id:this.options.verificationId}:{}),...this.campaignContext(),...extra.context},...(extra.outcomeId ? {outcome_id:extra.outcomeId} : {}),
    };
    if (encoder.encode(JSON.stringify(event)).length>8192) { this.rejected++; this.lastError="event_too_large"; return null; }
    this.queue.push(event); this.prune(); this.persist(); return event.event_id;
  }
  track(name, properties = {}, options = {}) { return this.event(name,properties,{outcomeId:options.outcomeId}); }
  page(path) {
    if (!this.collecting) return null;
    const route = normalizePath(path ?? globalThis.location?.pathname ?? "/");
    if (route === this.lastPage) return null;
    this.engagement(); this.lastPage=route;
    return this.event("page_view",{},{kind:"page",context:{path:route}});
  }
  screen(name) { return this.event("screen_view",{},{kind:"screen",context:{screen:String(name).slice(0,150)}}); }
  identify(userId, { token, traits = {} } = {}) {
    if (!this.collecting || !userId) return;
    if (this.user && this.user !== String(userId)) this.reset();
    this.user=String(userId); this.token=token; this.traits={...traits};
    this.event("fr_identify",{},{kind:"identify"});
  }
  setAccount(accountId) { if (this.collecting) this.account=accountId ? String(accountId) : null; }
  reset() {
    if (!this.collecting) return;
    this.engagement(); this.user=null; this.token=null; this.account=null; this.traits={}; this.identity=uuid(); this.session=null; this.lastPage=null; this.persist();
  }
  campaignContext() {
    const result={};
    if (!globalThis.location) return result;
    const params=new URLSearchParams(globalThis.location.search);
    for (const key of ["utm_source","utm_medium","utm_campaign","utm_content"]) if(params.get(key)) result[key]=params.get(key).slice(0,key==="utm_source"||key==="utm_medium"?100:150);
    const link=params.get("fr_link"); if (link && /^[0-9a-f-]{36}$/i.test(link)) result.campaign_link=link;
    try { if (globalThis.document?.referrer) result.referrer=new URL(globalThis.document.referrer).origin; } catch { /* ignore malformed referrers */ }
    return result;
  }
  engagement() {
    if (!this.collecting) return;
    const now=Date.now(); const elapsed=Math.min(15000,Math.max(0,now-this.lastTick)); this.lastTick=now;
    if (globalThis.document?.visibilityState === "hidden" || now-this.lastInteraction>60000 || !elapsed) return;
    this.event("fr_session",{},{kind:"session",context:{active_ms:elapsed,path:this.lastPage??"/"}});
  }
  attach() {
    if (!globalThis.addEventListener) return;
    const on=(target,name,callback)=>{target.addEventListener(name,callback);this.cleanups.push(()=>target.removeEventListener(name,callback));};
    for (const name of ["pointerdown","keydown","scroll","touchstart"]) on(globalThis,name,()=>{this.lastInteraction=Date.now();});
    on(globalThis,"online",()=>{this.retryAt=0;void this.flush();});
    on(globalThis,"popstate",()=>this.page());
    if (globalThis.document) on(document,"visibilitychange",()=>{
      if(document.visibilityState==="hidden") { this.persist(); this.beacon(); }
      else { this.lastTick=Date.now(); this.lastInteraction=Date.now(); void this.flush(); }
    });
    if (globalThis.history && this.options.autoPage!==false) {
      for (const name of ["pushState","replaceState"]) {
        const original=history[name];const client=this;
        const wrapped=function(...args){ const result=original.apply(this,args);client.page();return result;};
        history[name]=wrapped;this.cleanups.push(()=>{if(history[name]===wrapped)history[name]=original;});
      }
    }
  }
  batch() {
    this.prune();const events=[];
    for(const event of this.queue.slice(0,50)) { if(encoder.encode(JSON.stringify({key:this.options.key,events:[...events,event]})).length>65536)break;events.push(event); }
    return events;
  }
  beacon() {
    if(!this.collecting||!globalThis.navigator?.sendBeacon) return;
    const events=this.batch(); if(!events.length)return;
    try { navigator.sendBeacon(`${this.endpoint}/api/analytics/v2/collect`,new Blob([JSON.stringify({key:this.options.key,events})],{type:"text/plain"})); }
    catch { /* retained until acknowledged by fetch */ }
  }
  async flush() {
    if(!this.collecting||Date.now()<this.retryAt) return;
    if(this.inFlight)return this.inFlight;
    const generation=this.generation; const events=this.batch(); if(!events.length)return;
    this.controller=new AbortController();
    const delivery = {}; this.delivery = delivery;
    this.inFlight=(async()=>{
      try {
        const response=await (this.options.fetch??globalThis.fetch)(`${this.endpoint}/api/analytics/v2/collect`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:this.options.key,events}),signal:this.controller.signal});
        if(!this.collecting||this.generation!==generation)return;
        if(response.status===429||response.status>=500){this.failures++;this.retryAt=Date.now()+Math.max(Number(response.headers.get("Retry-After")??0)*1000,Math.min(300000,1000*2**Math.min(this.failures,8)));this.lastError=`delivery_${response.status}`;return;}
        const result=await response.json();
        if(!this.collecting||this.generation!==generation)return;
        if(!response.ok){this.lastError=result.error??"delivery_rejected";this.retryAt=Date.now()+300000;if([400,401,403,413].includes(response.status)){const ids=new Set(events.map(e=>e.event_id));this.queue=this.queue.filter(e=>!ids.has(e.event_id));this.rejected+=ids.size;}return;}
        const acknowledged=new Set();
        for(const receipt of result.results??[]){if(["accepted","duplicate","rejected"].includes(receipt.status))acknowledged.add(receipt.event_id);if(receipt.status==="rejected"){this.rejected++;this.lastError=receipt.reason;}else this.sent++;}
        this.queue=this.queue.filter(e=>!acknowledged.has(e.event_id));this.failures=0;this.retryAt=0;
      }catch(error){if(this.collecting&&this.generation===generation&&error?.name!=="AbortError"){this.lastError="network_unavailable";this.failures++;this.retryAt=Date.now()+Math.min(300000,1000*2**Math.min(this.failures,8));}}
      finally{if(this.collecting&&this.generation===generation)this.persist();if(this.delivery===delivery)this.inFlight=null;}
    })();
    return this.inFlight;
  }
  async decorateLink(url,destinationPropertyId) {
    if(!this.collecting)return url;
    const destination=new URL(url,globalThis.location?.href);if(!["http:","https:"].includes(destination.protocol)||destination.username||destination.password)return url;
    const response=await (this.options.fetch??fetch)(`${this.endpoint}/api/analytics/v2/link`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...this.collection.metadata(),key:this.options.key,anonymousId:this.identity,destinationPropertyId,destinationUrl:destination.origin})});
    if(!response.ok)return url;
    const {token}=await response.json();destination.searchParams.set("fr_handoff",token);return destination.toString();
  }
  async consumeHandoff(token) {
    if(!this.collecting)return;
    await (this.options.fetch??fetch)(`${this.endpoint}/api/analytics/v2/link`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...this.collection.metadata(),key:this.options.key,anonymousId:this.identity,token})});
  }
  getDiagnostics(){return {collectionMode:this.collection.mode,consentState:this.collection.permission,optedOut:this.collection.refused,collectionEnabled:this.collecting,consent:this.collection.permission==='granted',queued:this.queue.length,dropped:this.dropped,rejected:this.rejected,acknowledged:this.sent,lastError:this.lastError,anonymousId:this.collecting?this.identity:null};}
  destroy(){
    this.persist(); this.collection.destroyed = true; this.collecting = false; this.generation++;
    this.controller?.abort(); clearInterval(this.timer); this.timer = null;
    for (const remove of this.cleanups.splice(0)) remove();
    globalThis.removeEventListener?.('storage', this.preferenceListener);
    if (instances.get(this.options.key) === this) instances.delete(this.options.key);
  }
}

const instances=new Map();
export function init(options){const existing=instances.get(options.key);if(existing)return existing;const client=new FounderRouteAnalytics(options);instances.set(options.key,client);return client;}
