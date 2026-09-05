"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function FounderRoutePageViews({ client }) { const pathname=usePathname();useEffect(()=>{if(pathname)client.page(pathname);},[client,pathname]);return null; }
