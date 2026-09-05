export interface Options { endpoint: string; ios: {key:string;appId:string}; android: {key:string;appId:string}; allowedProperties?:string[]; allowedTraits?:string[] }
export interface Client {
  setConsent(granted:boolean):void;
  identify(id:string,options?:{token?:string;traits?:Record<string,string|number|boolean|null>}):void;
  setAccount(id:string|null):void;
  track(name:string,properties?:Record<string,string|number|boolean|null>,options?:{outcomeId?:string}):void;
  screen(name:string):void; reset():void; flush():void;
  getDiagnostics():Promise<{consent:boolean;queued:number;dropped:number;anonymousId:string|null}>;
}
export function init(options:Options):Client;
export function navigationAdapter(client:Client,ref:{current?:{getCurrentRoute():{name:string}|undefined}|null}):()=>void;
