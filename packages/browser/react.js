"use client";
import { useEffect } from "react";
// Integrates an application-owned permission decision without rendering anything.
export function useFounderRouteConsent(client, granted) {
  useEffect(() => { client.setConsent(granted); }, [client, granted]);
}
