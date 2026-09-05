// All persistence, consent, identity, and delivery live in the native SDK once.
export function createBridge(native, platform, options) {
  if (!native) throw new Error("Link FounderRoute's native module and rebuild the application.");
  const config = {...options, ...options[platform]};
  if (!config.key || !config.appId) throw new Error(`Register a ${platform} property and provide its public key and app ID.`);
  native.configure(config.key, config.endpoint, config.appId, config.allowedProperties ?? [], config.allowedTraits ?? []);
  return {
    setConsent: granted => native.setConsent(Boolean(granted)),
    identify: (id, {token, traits = {}} = {}) => native.identify(id, token ?? null, traits),
    setAccount: id => native.setAccount(id ?? null),
    track: (name, properties = {}, {outcomeId} = {}) => native.track(name, properties, outcomeId ?? null),
    screen: name => native.screen(name),
    reset: () => native.reset(),
    flush: () => native.flush(),
    getDiagnostics: () => native.getDiagnostics(),
  };
}
