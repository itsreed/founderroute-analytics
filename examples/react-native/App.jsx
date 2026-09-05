import React,{useState} from 'react';
import {View,Text,Switch,Button} from 'react-native';
import {init} from '@founderroute/analytics-react-native';
export default function App({configuration}){
  const [analytics]=useState(()=>init(configuration));const [consent,setConsent]=useState(false);
  return <View><Text>FounderRoute native example</Text><Switch accessibilityLabel="Allow analytics" value={consent} onValueChange={value=>{setConsent(value);analytics.setConsent(value);if(value)analytics.screen('Home');}}/><Button title="Open editor" onPress={()=>analytics.screen('Editor')}/><Button title="Publish" onPress={()=>analytics.track('document_published')}/><Button title="Log out" onPress={()=>analytics.reset()}/></View>;
}
