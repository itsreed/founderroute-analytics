package com.founderroute.analytics

import android.content.Context
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.work.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.Callable
import java.util.concurrent.atomic.AtomicBoolean

class FounderRouteAnalytics private constructor(private val context: Context, private val key: String, private val endpoint: String, private val appId: String, private val allowedProperties: Set<String>, private val allowedTraits: Set<String>,private val verificationId:String?, private val requestedMode:String?, private var propertyId:String?, private var environment:String?) : DefaultLifecycleObserver {
    companion object {
        private fun timestamp(value:Long):String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.US).apply { timeZone=TimeZone.getTimeZone("UTC") }.format(Date(value))
        private fun timestampMillis(value:String):Long {
            val pattern=if(value.contains('.')) "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'" else "yyyy-MM-dd'T'HH:mm:ss'Z'"
            return SimpleDateFormat(pattern,Locale.US).apply { timeZone=TimeZone.getTimeZone("UTC");isLenient=false }.parse(value)?.time ?: 0L
        }
        @Volatile internal var connectionFactory:(URL)->HttpURLConnection = { it.openConnection() as HttpURLConnection }
        @Volatile private var instance: FounderRouteAnalytics? = null
        @Synchronized fun init(context: Context, key: String, endpoint: String, appId: String, allowedProperties: Set<String> = emptySet(), allowedTraits: Set<String> = emptySet(),verificationId:String?=null, collectionMode:String?=null, propertyId:String?=null, environment:String?=null): FounderRouteAnalytics {
            require(key.startsWith("fr_pk_")); require(endpoint.startsWith("https://") || endpoint.startsWith("http://localhost"))
            return instance ?: FounderRouteAnalytics(context.applicationContext,key,endpoint.trimEnd('/'),appId,allowedProperties,allowedTraits,verificationId,collectionMode,propertyId,environment).also { instance=it; android.os.Handler(android.os.Looper.getMainLooper()).post { ProcessLifecycleOwner.get().lifecycle.addObserver(it) } }
        }
        fun current() = instance
        fun restore(context:Context,data:Data):FounderRouteAnalytics? {
            val key=data.getString("key")?:return null
            val scope=if(data.getString("propertyId")!=null) "${data.getString("propertyId")}-${data.getString("environment")}" else key.takeLast(16)
            val file=File(context.noBackupFilesDir,"founderroute-$scope.json")
            if(File(context.noBackupFilesDir,"founderroute-$scope.refusal").exists())return null
            if(!file.exists())return null
            val saved=try{JSONObject(file.readText())}catch(_:Exception){return null}
            if(!saved.optBoolean("collection_enabled",saved.optBoolean("consent",false)))return null
            return init(context,key,data.getString("endpoint")?:return null,data.getString("appId")?:return null,
              (data.getStringArray("properties")?:emptyArray()).toSet(),(data.getStringArray("traits")?:emptyArray()).toSet(),data.getString("verificationId"),data.getString("collectionMode"),data.getString("propertyId"),data.getString("environment")).also{client->client.executor.execute{client.consentState=saved.optString("consent_state",if(saved.optBoolean("consent",false))"granted" else "not_provided");client.reconcileCollection()}}
        }
    }
    private val executor = Executors.newSingleThreadScheduledExecutor()
    private val permitted = AtomicBoolean(false)
    private val stopRequested = AtomicBoolean(false)
    private var configurationReady = false
    @Volatile private var activeConnection:HttpURLConnection?=null
    private var collectionMode:String? = null
    private var consentState = "not_provided"
    private var refused = false
    private var destroyed = false
    private var consent = false; private var foreground = true; private var events = mutableListOf<JSONObject>()
    private var anonymousId: String? = null; private var userId: String? = null; private var accountId: String? = null; private var token: String? = null
    private var traits = JSONObject(); private var session = ""; private var lastActivity = 0L
    private var campaign = JSONObject()
    private var dropped = 0; private var rejected = 0; private var acknowledged = 0; private var lastError: String? = null; private var retryAt = 0L; private var failures = 0
    private val scope get() = if(propertyId!=null&&environment!=null) "$propertyId-$environment" else key.takeLast(16)
    private val file get() = File(context.noBackupFilesDir,"founderroute-$scope.json")
    private val legacyFile get() = File(context.noBackupFilesDir,"founderroute-${key.takeLast(16)}.json")
    private val refusalFile get() = File(context.noBackupFilesDir,"founderroute-$scope.refusal")
    private fun saveRefusal(value:Boolean) {
        refused=value
        try { if(value) refusalFile.writeText("refused") else if(refusalFile.exists()&&!refusalFile.delete())throw IllegalStateException() }
        catch(_:Exception){lastError="preference_storage_unavailable"}
    }
    private fun configureCollection() {
        try {
            require(requestedMode==null||requestedMode in listOf("automatic","consent"))
            if(propertyId==null||environment==null||requestedMode==null) {
                val connection=connectionFactory(URL("$endpoint/api/analytics/v2/config?key=${java.net.URLEncoder.encode(key,"UTF-8")}"))
                val config=try { connection.connectTimeout=10000;connection.readTimeout=10000;require(connection.responseCode==200);JSONObject(connection.inputStream.bufferedReader().use{it.readText()}) }finally{connection.disconnect()}
                propertyId=config.getString("property_id");environment=config.getString("environment");collectionMode=requestedMode?:config.getString("collection_mode")
            } else collectionMode=requestedMode
            require(propertyId!!.matches(Regex("[a-zA-Z0-9_-]+"))&&environment in listOf("production","test")&&collectionMode in listOf("automatic","consent"))
            refused=refused||refusalFile.exists()
            if(refused)saveRefusal(true)
            configurationReady=true
            reconcileCollection()
        } catch(_:Exception){lastError="configuration_unavailable";permitted.set(false)}
    }
    fun optOut() { stopRequested.set(true);permitted.set(false);activeConnection?.disconnect();executor.execute{consentState="denied";saveRefusal(true);reconcileCollection()} }
    fun optIn() { stopRequested.set(false);executor.execute{saveRefusal(false);if(consentState=="denied")consentState="not_provided";reconcileCollection()} }
    fun setCollectionMode(mode:String) { require(mode in listOf("automatic","consent"));executor.execute{collectionMode=mode;reconcileCollection()} }
    fun destroy() { stopRequested.set(true);permitted.set(false);activeConnection?.disconnect();executor.execute{destroyed=true;consent=false;WorkManager.getInstance(context).cancelUniqueWork("founderroute-delivery");android.os.Handler(android.os.Looper.getMainLooper()).post{ProcessLifecycleOwner.get().lifecycle.removeObserver(this)};synchronized(Companion){if(instance===this)instance=null};executor.shutdown()} }
    private fun reconcileCollection() {
        val enabled=configurationReady&&!stopRequested.get()&&!destroyed&&!refused&&(collectionMode=="automatic"||(collectionMode=="consent"&&consentState=="granted"))
        setCollecting(enabled)
    }
    init { executor.execute{configureCollection()};executor.scheduleWithFixedDelay({ if(consent) { if(foreground) enqueue("fr_session","session",JSONObject(),JSONObject().put("active_ms",15000)); deliver() } },15,15,TimeUnit.SECONDS) }
    fun setConsent(granted: Boolean) { stopRequested.set(!granted);if(!granted){permitted.set(false);activeConnection?.disconnect()};executor.execute{consentState=if(granted)"granted" else "denied";saveRefusal(!granted);reconcileCollection()} }
    private fun setCollecting(requested: Boolean) { val granted=requested&&!stopRequested.get();permitted.set(granted); if(!granted)activeConnection?.disconnect();
        if(!granted&&refused){file.delete();legacyFile.delete()}
        if(consent==granted)return
        consent=granted
        if(!granted) { events.clear(); anonymousId=null; userId=null; accountId=null; token=null; traits=JSONObject(); campaign=JSONObject(); file.delete(); WorkManager.getInstance(context).cancelUniqueWork("founderroute-delivery"); return }
        val restoreFile=if(file.exists())file else legacyFile
        try { if(restoreFile.exists()) { val saved=JSONObject(restoreFile.readText()); dropped=saved.optInt("dropped",0); anonymousId=saved.optString("anonymous_id").takeIf{it.isNotBlank()}; val queue=saved.optJSONArray("events")?:JSONArray(); events=(0 until queue.length()).map { queue.getJSONObject(it) }.toMutableList() } } catch(_:Exception) { lastError="storage_unavailable" }
        if(anonymousId==null)anonymousId=UUID.randomUUID().toString()
        prune(); persist(); if(file.exists()&&legacyFile!=file)legacyFile.delete(); schedule(); deliver()
    }
    fun identify(id:String, identityToken:String?=null, userTraits:JSONObject=JSONObject()) { executor.execute { if(consent) { if(userId!=null&&userId!=id) resetIdentity(); userId=id;token=identityToken;traits=JSONObject(userTraits.toString());enqueue("fr_identify","identify",JSONObject()) } } }
    fun setAccount(id:String?) { executor.execute { if(consent)accountId=id } }
    fun reset() { executor.execute { if(consent) {resetIdentity();persist()} } }
    private fun resetIdentity() { anonymousId=UUID.randomUUID().toString();userId=null;accountId=null;token=null;traits=JSONObject();session=UUID.randomUUID().toString();lastActivity=0 }
    fun track(name:String, properties:JSONObject=JSONObject(), outcomeId:String?=null) { val snapshot=JSONObject(properties.toString());executor.execute { enqueue(name,"custom",snapshot,outcomeId=outcomeId) } }
    fun screen(name:String) { executor.execute { enqueue("screen_view","screen",JSONObject(),JSONObject().put("screen",name.take(150))) } }
    /** Pass an installed-app deep link only after consent. No app-store attribution is inferred. */
    fun setCampaignContext(url:String) { executor.execute {
        if(!consent||!permitted.get())return@execute
        val uri=android.net.Uri.parse(url);val next=JSONObject()
        for((key,limit) in mapOf("utm_source" to 100,"utm_medium" to 100,"utm_campaign" to 150,"utm_content" to 150)) uri.getQueryParameter(key)?.let{next.put(key,it.take(limit))}
        uri.getQueryParameter("fr_link")?.let { try { next.put("campaign_link",UUID.fromString(it).toString()) } catch(_:Exception){} }
        campaign=next
    } }
    fun flush() { executor.execute { deliver() } }
    fun flushForWorker():Boolean = executor.submit(Callable {
        val deadline=System.currentTimeMillis()+25000
        while(consent&&permitted.get()&&events.isNotEmpty()&&System.currentTimeMillis()<deadline&&System.currentTimeMillis()>=retryAt)deliver()
        !permitted.get()||events.isEmpty()
    }).get(30,TimeUnit.SECONDS)
    fun getDiagnostics(callback:(JSONObject)->Unit) { executor.execute { callback(JSONObject().put("consent",consentState=="granted").put("collectionMode",collectionMode?:JSONObject.NULL).put("consentState",consentState).put("optedOut",refused).put("collectionEnabled",consent&&permitted.get()).put("queued",events.size).put("dropped",dropped).put("rejected",rejected).put("acknowledged",acknowledged).put("anonymousId",anonymousId?:JSONObject.NULL).put("lastError",lastError?:JSONObject.NULL)) } }
    private fun sanitize(input:JSONObject, allowed:Set<String>):JSONObject { val output=JSONObject();input.keys().forEach { key -> val value=input.opt(key); if(key in allowed&&!Regex("password|secret|token|email|phone|authorization|address|full.?name",RegexOption.IGNORE_CASE).containsMatchIn(key)) { if(value is String)output.put(key,value.take(500));else if(value is Number||value is Boolean||value==JSONObject.NULL)output.put(key,value) } };return output }
    private fun enqueue(name:String,kind:String,properties:JSONObject,extra:JSONObject=JSONObject(),outcomeId:String?=null) {
        if(!consent||!permitted.get()||anonymousId==null)return
        val now=System.currentTimeMillis();if(now-lastActivity>=1800000)session=UUID.randomUUID().toString();lastActivity=now
        val ctx=JSONObject().put("sdk","android").put("sdk_version","1.0.0-rc.1").put("app_id",appId);extra.keys().forEach { ctx.put(it,extra.get(it)) }
        verificationId?.let{ctx.put("verification_id",it)}
        campaign.keys().forEach { ctx.put(it,campaign.get(it)) }
        val event=JSONObject().put("event_id",UUID.randomUUID().toString()).put("protocol",2).put("name",name).put("kind",kind).put("occurred_at",timestamp(now)).put("anonymous_id",anonymousId).put("session_id",session).put("collection_mode",collectionMode).put("consent_state",if(consentState=="granted")"granted" else "not_provided").put("properties",sanitize(properties,allowedProperties)).put("traits",sanitize(traits,allowedTraits)).put("context",ctx)
        userId?.let{event.put("user_id",it)};accountId?.let{event.put("account_id",it)};token?.let{event.put("identity_token",it)};outcomeId?.let{event.put("outcome_id",it)}
        if(event.toString().toByteArray().size>8192){rejected++;lastError="event_too_large";return}
        events.add(event);prune();persist();schedule()
    }
    private fun prune() {
        val cutoff=System.currentTimeMillis()-7*86400000L;val size=events.size
        events.removeAll { try { timestampMillis(it.getString("occurred_at"))<cutoff } catch(_:Exception){true} };dropped+=size-events.size
        while(events.size>10000||JSONArray(events).toString().toByteArray().size>10*1024*1024){events.removeAt(0);dropped++}
    }
    private fun persist() { if(!consent||!permitted.get())return;try { val temp=File(file.path+".tmp");temp.writeText(JSONObject().put("collection_enabled",true).put("consent_state",consentState).put("dropped",dropped).put("anonymous_id",anonymousId).put("events",JSONArray(events)).toString()); if(!temp.renameTo(file)){file.writeText(temp.readText());temp.delete()} }catch(_:Exception){lastError="storage_unavailable"} }
    private fun schedule() { val constraints=Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();val request=OneTimeWorkRequestBuilder<AnalyticsDeliveryWorker>().setInputData(workDataOf("key" to key,"endpoint" to endpoint,"appId" to appId,"properties" to allowedProperties.toTypedArray(),"traits" to allowedTraits.toTypedArray(),"verificationId" to verificationId,"collectionMode" to collectionMode,"propertyId" to propertyId,"environment" to environment)).setConstraints(constraints).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build();WorkManager.getInstance(context).enqueueUniqueWork("founderroute-delivery",ExistingWorkPolicy.KEEP,request) }
    private fun deliver() {
        if(!consent||!permitted.get()||System.currentTimeMillis()<retryAt)return
        prune();val batch=mutableListOf<JSONObject>();for(event in events.take(50)){if(JSONObject().put("key",key).put("events",JSONArray(batch+event)).toString().toByteArray().size>65536)break;batch.add(event)};if(batch.isEmpty())return
        var connection:HttpURLConnection?=null
        try {
            connection=connectionFactory(URL("$endpoint/api/analytics/v2/collect"));activeConnection=connection;connection.requestMethod="POST";connection.setRequestProperty("Content-Type","application/json");connection.doOutput=true;connection.connectTimeout=10000;connection.readTimeout=15000
            if(!permitted.get())return
            connection.outputStream.use{it.write(JSONObject().put("key",key).put("events",JSONArray(batch)).toString().toByteArray())}
            val status=connection.responseCode
            if(!permitted.get())return
            if(status==429||status>=500){retry("delivery_$status");return}
            if(status!=200){val ids=batch.map{it.getString("event_id")}.toSet();events.removeAll{it.getString("event_id") in ids};rejected+=ids.size;lastError="delivery_rejected";persist();return}
            val response=JSONObject(connection.inputStream.bufferedReader().use{it.readText()});val results=response.optJSONArray("results")?:JSONArray();val ids=mutableSetOf<String>()
            if(!permitted.get())return
            for(i in 0 until results.length()){val receipt=results.getJSONObject(i);val state=receipt.optString("status");if(state in listOf("accepted","duplicate","rejected")){ids.add(receipt.getString("event_id"));if(state=="rejected"){rejected++;lastError=receipt.optString("reason")}else acknowledged++}}
            events.removeAll{it.getString("event_id") in ids};failures=0;retryAt=0;persist()
        }catch(_:Exception){retry("network_unavailable")}finally{connection?.disconnect();activeConnection=null}
    }
    private fun retry(reason:String){lastError=reason;failures++;retryAt=System.currentTimeMillis()+minOf(300000L,1000L shl minOf(failures,8));schedule()}
    override fun onStart(owner:LifecycleOwner){executor.execute{foreground=true;retryAt=0;deliver()}}
    override fun onStop(owner:LifecycleOwner){executor.execute{foreground=false;deliver()}}
}
class AnalyticsDeliveryWorker(context:Context,params:WorkerParameters):Worker(context,params){
    override fun doWork():Result { val client=FounderRouteAnalytics.current()?:FounderRouteAnalytics.restore(applicationContext,inputData)?:return Result.success();return try{if(client.flushForWorker())Result.success()else Result.retry()}catch(_:Exception){Result.retry()} }
}
