import {useEffect,useRef} from 'react';
import {init} from '../../packages/browser/index.js';
export default function AnalyticsExample({publicKey,collectorOrigin,propertyId}) {
  const client=useRef(null);
  useEffect(()=>{
    const analytics=init({key:publicKey,endpoint:collectorOrigin,propertyId,environment:'test',collectionMode:'automatic',allowedProperties:['feature']});
    client.current=analytics;
    return ()=>{analytics.destroy();client.current=null;};
  },[publicKey,collectorOrigin,propertyId]);
  return <main><h1>FounderRoute React example</h1><button onClick={()=>client.current?.track('document_published',{feature:'editor'},{outcomeId:crypto.randomUUID()})}>Publish</button><button onClick={()=>client.current?.reset()}>Log out</button></main>;
}
