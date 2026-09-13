import React,{useEffect,useRef} from 'react';
import {View,Text,Button} from 'react-native';
import {init} from '@founderroute/analytics-react-native';
export default function App({configuration}) {
  const client=useRef(null);
  useEffect(()=>{
    const analytics=init({...configuration,collectionMode:configuration.collectionMode??'automatic'});
    client.current=analytics;
    analytics.screen('Home');
    return ()=>{analytics.destroy();client.current=null;};
  },[configuration]);
  return <View><Text>FounderRoute native example</Text><Button title="Open editor" onPress={()=>client.current?.screen('Editor')}/><Button title="Publish" onPress={()=>client.current?.track('document_published')}/><Button title="Log out" onPress={()=>client.current?.reset()}/></View>;
}
