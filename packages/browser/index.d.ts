export type Scalar = string | number | boolean | null;
export type AnalyticsOptions = { key: string; endpoint: string; verificationId?: string; autoPage?: boolean; allowedProperties?: string[]; allowedTraits?: string[]; storage?: Pick<Storage,"getItem"|"setItem"|"removeItem">; fetch?: typeof fetch };
export class FounderRouteAnalytics {
  constructor(options: AnalyticsOptions);
  setConsent(granted: boolean): void;
  identify(userId: string, options?: {token?: string;traits?: Record<string,Scalar>}): void;
  setAccount(accountId: string | null): void;
  track(name: string, properties?: Record<string,Scalar>, options?: {outcomeId?: string}): string | null;
  page(path?: string): string | null;
  screen(name: string): string | null;
  reset(): void;
  flush(): Promise<void>;
  decorateLink(url:string,destinationPropertyId:string):Promise<string>;
  consumeHandoff(token:string):Promise<void>;
  getDiagnostics(): {consent:boolean;queued:number;dropped:number;rejected:number;acknowledged:number;lastError:string|null;anonymousId:string|null};
  destroy(): void;
}
export function init(options: AnalyticsOptions): FounderRouteAnalytics;
export function normalizePath(value:string):string;
