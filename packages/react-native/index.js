import { NativeModules, Platform } from "react-native";
import { createBridge } from "./bridge.js";
let client;
export function init(options) {
  if (!client) {
    const bridge = createBridge(NativeModules.FounderRouteAnalyticsModule, Platform.OS, options);
    client = {...bridge, destroy() { bridge.destroy(); client = undefined; }};
  }
  return client;
}
export function navigationAdapter(client, navigationRef) {
  let previous;
  return () => {
    const name = navigationRef.current?.getCurrentRoute()?.name;
    if (name && name !== previous) { previous = name; client.screen(name); }
  };
}
