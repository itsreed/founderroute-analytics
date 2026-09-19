export type Scalar = string | number | boolean | null;
export type AnalyticsOptions = { key: string; endpoint: string; propertyId?: string; environment?: "production" | "test"; collectionMode?: "automatic" | "consent"; verificationId?: string; autoPage?: boolean; allowedProperties?: string[]; allowedTraits?: string[]; storage?: Pick<Storage,"getItem"|"setItem"|"removeItem">; fetch?: typeof fetch };
export class FounderRouteAnalytics {
  constructor(options: AnalyticsOptions);
  readonly ready: Promise<void>;
  setConsent(granted: boolean): void;
  optOut(): void;
  optIn(): void;
  setCollectionMode(mode: "automatic" | "consent"): void;
  identify(userId: string, options?: {token?: string;traits?: Record<string,Scalar>}): void;
  setAccount(accountId: string | null): void;
  track(name: string, properties?: Record<string,Scalar>, options?: {outcomeId?: string}): string | null;
  page(path?: string): string | null;
  screen(name: string): string | null;
  reset(): void;
  flush(): Promise<void>;
  decorateLink(url:string,destinationPropertyId:string):Promise<string>;
  consumeHandoff(token:string):Promise<void>;
  getDiagnostics(): {collectionMode:"automatic"|"consent"|null;consentState:"not_provided"|"granted"|"denied";optedOut:boolean;collectionEnabled:boolean;consent:boolean;queued:number;dropped:number;rejected:number;acknowledged:number;lastError:string|null;anonymousId:string|null};
  destroy(): void;
}
export function init(options: AnalyticsOptions): FounderRouteAnalytics;
export function normalizePath(value:string):string;
