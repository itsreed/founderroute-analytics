package com.founderroute.analytics.reactnative
import com.facebook.react.bridge.*
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import com.founderroute.analytics.FounderRouteAnalytics
import org.json.JSONObject

class FounderRouteAnalyticsModule(private val context:ReactApplicationContext):ReactContextBaseJavaModule(context) {
    override fun getName()="FounderRouteAnalyticsModule"
    private var client:FounderRouteAnalytics?=null
    @ReactMethod fun configure(key:String,endpoint:String,appId:String,properties:ReadableArray,traits:ReadableArray,verificationId:String?) { client=FounderRouteAnalytics.init(context,key,endpoint,appId,properties.toArrayList().map{it.toString()}.toSet(),traits.toArrayList().map{it.toString()}.toSet(),verificationId) }
    @ReactMethod fun setConsent(value:Boolean){client?.setConsent(value)}
    @ReactMethod fun identify(id:String,token:String?,traits:ReadableMap){client?.identify(id,token,JSONObject(traits.toHashMap()))}
    @ReactMethod fun setAccount(id:String?){client?.setAccount(id)}
    @ReactMethod fun track(name:String,properties:ReadableMap,outcomeId:String?){client?.track(name,JSONObject(properties.toHashMap()),outcomeId)}
    @ReactMethod fun screen(name:String){client?.screen(name)}
    @ReactMethod fun reset(){client?.reset()}
    @ReactMethod fun flush(){client?.flush()}
    @ReactMethod fun getDiagnostics(promise:Promise){val analytics=client;if(analytics==null){promise.reject("not_initialized","Initialize FounderRoute first.");return};analytics.getDiagnostics{data->val result=Arguments.createMap();data.keys().forEach{key->when(val v=data.get(key)){is Boolean->result.putBoolean(key,v);is Number->result.putDouble(key,v.toDouble());JSONObject.NULL->result.putNull(key);else->result.putString(key,v.toString())}};promise.resolve(result)}}
}
class FounderRouteAnalyticsPackage:ReactPackage {
    override fun createNativeModules(context:ReactApplicationContext)=listOf<NativeModule>(FounderRouteAnalyticsModule(context))
    override fun createViewManagers(context:ReactApplicationContext)=emptyList<ViewManager<*,*>>()
}
