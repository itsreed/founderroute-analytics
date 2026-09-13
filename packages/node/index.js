import { createHash, createHmac, randomUUID } from "node:crypto";
export function signIdentity({secret,propertyId,userId,expiresInSeconds=3600}) {
  if(!secret?.startsWith("fr_sk_")||!propertyId||!userId)throw new Error("A server key, property, and opaque user ID are required.");
  const payload=Buffer.from(JSON.stringify({property_id:propertyId,user_id:userId,exp:Math.floor(Date.now()/1000)+Math.min(604800,Math.max(60,expiresInSeconds))})).toString("base64url");
  const signingKey=createHash("sha256").update(secret).digest("hex");
  return `${payload}.${createHmac("sha256",signingKey).update(payload).digest("base64url")}`;
}
export class FounderRouteServer {
  constructor({secret,endpoint,fetch:transport=globalThis.fetch}) { if(!secret?.startsWith("fr_sk_"))throw new Error("A server ingest secret is required.");this.secret=secret;this.endpoint=endpoint.replace(/\/$/,"");this.fetch=transport; }
  event(name,{collectionMode,consentState,optedOut=false,consent,userId,anonymousId,eventId=randomUUID(),outcomeId,accountId,occurredAt=new Date().toISOString(),traits={},properties={},verificationId}) {
    if (collectionMode != null && !['automatic','consent'].includes(collectionMode)) throw new Error('Invalid collection mode');
    if (consentState != null && !['not_provided','granted','denied'].includes(consentState)) throw new Error('Invalid consent state');
    if (optedOut || consent === false || consentState === 'denied') return null;
    const mode = collectionMode ?? 'consent';
    const granted = consentState === 'granted' || consent === true;
    if (mode === 'consent' && !granted) return null;
    const collection = collectionMode == null
      ? {protocol:1,consent:true}
      : {protocol:2,collection_mode:mode,consent_state:granted?'granted':'not_provided'};
    if(!userId||!anonymousId)throw new Error("Pass a stable user ID and the originating anonymous ID.");
    return {event_id:eventId,...collection,name,kind:"custom",occurred_at:occurredAt,anonymous_id:anonymousId,user_id:userId,...(outcomeId?{outcome_id:outcomeId}:{}),...(accountId?{account_id:accountId}:{}),traits,properties,context:{sdk:"node",sdk_version:"1.0.0-rc.1",...(verificationId?{verification_id:verificationId}:{})}};
  }
  async send(events) {
    const batch=events.filter(Boolean);if(!batch.length)return {results:[]};
    if(batch.length>50)throw new Error("Send at most 50 events per batch.");
    const body=JSON.stringify({events:batch});if(Buffer.byteLength(body)>65536)throw new Error("Batch exceeds 64 KiB.");
    const response=await this.fetch(`${this.endpoint}/api/analytics/v${batch.some(event=>event.protocol===2)?2:1}/server-events`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${this.secret}`},body});
    const result=await response.json();if(!response.ok){const error=new Error(result.error??"Analytics delivery failed");error.status=response.status;error.retryAfter=response.headers.get("Retry-After");throw error;}return result;
  }
}
