'use client';
import AnalyticsExample from '../../react/AnalyticsExample.jsx';
export default function Page(){return <AnalyticsExample publicKey={process.env.NEXT_PUBLIC_FOUNDERROUTE_KEY} collectorOrigin={process.env.NEXT_PUBLIC_FOUNDERROUTE_ORIGIN}/>;}
