"use client";
import { useEffect } from "react";
export function FounderRouteConsent({ client, granted, children }) { useEffect(()=>{client.setConsent(granted);},[client,granted]);return children??null; }
