#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(FounderRouteAnalyticsModule, NSObject)
RCT_EXTERN_METHOD(configure:(NSString *)key endpoint:(NSString *)endpoint appId:(NSString *)appId properties:(NSArray *)properties traits:(NSArray *)traits verificationId:(NSString *)verificationId)
RCT_EXTERN_METHOD(setConsent:(BOOL)value)
RCT_EXTERN_METHOD(identify:(NSString *)identifier token:(NSString *)token traits:(NSDictionary *)traits)
RCT_EXTERN_METHOD(setAccount:(NSString *)identifier)
RCT_EXTERN_METHOD(track:(NSString *)name properties:(NSDictionary *)properties outcomeId:(NSString *)outcomeId)
RCT_EXTERN_METHOD(screen:(NSString *)name)
RCT_EXTERN_METHOD(reset)
RCT_EXTERN_METHOD(flush)
RCT_EXTERN_METHOD(getDiagnostics:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
