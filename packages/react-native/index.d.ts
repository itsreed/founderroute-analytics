export interface PropertyOptions {key:string;appId:string;propertyId?:string;environment?:"production"|"test";collectionMode?:"automatic"|"consent"}
export interface Options { endpoint: string; verificationId?:string; collectionMode?:"automatic"|"consent"; ios: PropertyOptions; android: PropertyOptions; allowedProperties?:string[]; allowedTraits?:string[] }
export interface Client {
  optOut():void; optIn():void; destroy():void; setCollectionMode(mode:"automatic"|"consent"):void;
  setConsent(granted:boolean):void;
  identify(id:string,options?:{token?:string;traits?:Record<string,string|number|boolean|null>}):void;
  setAccount(id:string|null):void;
  track(name:string,properties?:Record<string,string|number|boolean|null>,options?:{outcomeId?:string}):void;
  screen(name:string):void; reset():void; flush():void;
  setCampaignContext(url:string):void;
  getDiagnostics():Promise<{consent:boolean;collectionMode:"automatic"|"consent"|null;consentState:"not_provided"|"granted"|"denied";optedOut:boolean;collectionEnabled:boolean;queued:number;dropped:number;anonymousId:string|null}>;
}
export function init(options:Options):Client;
export function navigationAdapter(client:Client,ref:{current?:{getCurrentRoute():{name:string}|undefined}|null}):()=>void;
