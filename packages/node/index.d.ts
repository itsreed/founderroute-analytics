export function signIdentity(input:{secret:string;propertyId:string;userId:string;expiresInSeconds?:number}):string;
export class FounderRouteServer {
  constructor(options:{secret:string;endpoint:string;fetch?:typeof fetch});
  event(name:string,input:{consent:boolean;userId:string;anonymousId:string;eventId?:string;outcomeId?:string;accountId?:string;occurredAt?:string;traits?:Record<string,unknown>;properties?:Record<string,unknown>}):Record<string,unknown>|null;
  send(events:Array<Record<string,unknown>|null>):Promise<{results:Array<{event_id:string;status:string;reason?:string}>}>;
}
