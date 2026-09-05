package com.founderroute.analytics
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import org.json.JSONObject
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class DeliveryTest {
    private fun diagnostics(client:FounderRouteAnalytics):JSONObject {
        val complete=CountDownLatch(1);var result=JSONObject()
        client.getDiagnostics{result=it;complete.countDown()};assertTrue(complete.await(5,TimeUnit.SECONDS));return result
    }
    @Test fun offlineRetryPreservesEventIdAndAcknowledgementClearsQueue() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val client=FounderRouteAnalytics.init(context,"fr_pk_fixture_consent","https://collector.example","example.fixture")
        client.setConsent(false);diagnostics(client)
        var offline=true;val bodies=mutableListOf<JSONObject>()
        FounderRouteAnalytics.connectionFactory={url->object:HttpURLConnection(url){
            val output=ByteArrayOutputStream()
            override fun connect(){};override fun disconnect(){};override fun usingProxy()=false
            override fun getOutputStream()=output
            override fun getResponseCode():Int { synchronized(bodies){bodies.add(JSONObject(output.toString("UTF-8")))};if(offline)throw java.io.IOException("offline");return 200 }
            override fun getInputStream():ByteArrayInputStream { val batch=JSONObject(output.toString("UTF-8")).getJSONArray("events");val results=JSONArray();for(i in 0 until batch.length())results.put(JSONObject().put("event_id",batch.getJSONObject(i).getString("event_id")).put("status","accepted"));return ByteArrayInputStream(JSONObject().put("results",results).toString().toByteArray()) }
        }}
        try{
            client.setConsent(true);client.track("document_published",outcomeId="offline-operation");client.flush()
            var state=diagnostics(client);assertEquals(1,state.getInt("queued"));assertEquals("network_unavailable",state.getString("lastError"))
            val original=synchronized(bodies){bodies.first().getJSONArray("events").getJSONObject(0).getString("event_id")}
            offline=false
            client.onStart(object:androidx.lifecycle.LifecycleOwner{override val lifecycle:androidx.lifecycle.Lifecycle get()=throw UnsupportedOperationException()})
            state=diagnostics(client);assertEquals(0,state.getInt("queued"));assertEquals(1,state.getInt("acknowledged"))
            val delivered=synchronized(bodies){bodies.last().getJSONArray("events").getJSONObject(0).getString("event_id")};assertEquals(original,delivered)
            client.setConsent(false);assertTrue(diagnostics(client).isNull("anonymousId"))
        }finally{FounderRouteAnalytics.connectionFactory={it.openConnection() as HttpURLConnection};client.setConsent(false)}
    }
}
