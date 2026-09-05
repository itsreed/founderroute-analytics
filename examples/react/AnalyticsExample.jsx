import {useMemo,useState} from 'react';
import {init} from '../../packages/browser/index.js';
export default function AnalyticsExample({publicKey,collectorOrigin}) {
  const analytics=useMemo(()=>init({key:publicKey,endpoint:collectorOrigin,allowedProperties:['feature']}),[publicKey,collectorOrigin]);
  const [consent,setConsent]=useState(false);
  return <main><h1>FounderRoute React example</h1><label><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);analytics.setConsent(e.target.checked);}}/>Allow analytics</label><button onClick={()=>analytics.track('document_published',{feature:'editor'},{outcomeId:crypto.randomUUID()})}>Publish</button><button onClick={()=>analytics.reset()}>Log out</button></main>;
}
