package com.founderroute.analytics
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ConsentTest {
    @Test fun deniedConsentHasNoIdentityOrQueue() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val sdk=FounderRouteAnalytics.init(context,"fr_pk_fixture_consent","https://collector.example","example.fixture",collectionMode="consent",propertyId="fixture",environment="test")
        sdk.setConsent(false); sdk.track("before_consent"); sdk.flush()
        val complete=CountDownLatch(1)
        sdk.getDiagnostics { result -> assertFalse(result.getBoolean("consent"));assertEquals(0,result.getInt("queued"));assertTrue(result.isNull("anonymousId"));complete.countDown() }
        assertTrue(complete.await(5,TimeUnit.SECONDS))
    }

    private fun state(sdk:FounderRouteAnalytics):org.json.JSONObject {
        val complete=CountDownLatch(1);var result=org.json.JSONObject()
        sdk.getDiagnostics{result=it;complete.countDown()};assertTrue(complete.await(5,TimeUnit.SECONDS));return result
    }
    @Test fun automaticPermissionAndRefusalRemainDistinct() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val sdk=FounderRouteAnalytics.init(context,"fr_pk_fixture_consent","https://collector.example","example.fixture",collectionMode="consent",propertyId="fixture",environment="test")
        sdk.optOut();state(sdk)
        sdk.setCollectionMode("automatic");sdk.optIn();sdk.screen("Home")
        val active=state(sdk)
        assertTrue(active.getBoolean("collectionEnabled"));assertFalse(active.getBoolean("consent"))
        assertEquals("not_provided",active.getString("consentState"));assertEquals(1,active.getInt("queued"))
        val file=java.io.File(context.noBackupFilesDir,"founderroute-fixture-test.json")
        val event=org.json.JSONObject(file.readText()).getJSONArray("events").getJSONObject(0)
        assertEquals(2,event.getInt("protocol"));assertEquals("automatic",event.getString("collection_mode"))
        assertEquals("not_provided",event.getString("consent_state"));assertFalse(event.has("consent"))
        sdk.reset();sdk.setCollectionMode("consent");sdk.optIn();sdk.screen("blocked")
        assertEquals(0,state(sdk).getInt("queued"))
        sdk.setConsent(true);sdk.screen("granted");assertEquals(1,state(sdk).getInt("queued"))
        sdk.optOut();sdk.reset();sdk.setCollectionMode("automatic");sdk.screen("blocked")
        val denied=state(sdk);assertTrue(denied.getBoolean("optedOut"));assertFalse(denied.getBoolean("collectionEnabled"))
        assertTrue(denied.isNull("anonymousId"));assertEquals(0,denied.getInt("queued"))
        assertFalse(file.exists());assertTrue(java.io.File(context.noBackupFilesDir,"founderroute-fixture-test.refusal").exists())
        sdk.setCollectionMode("consent");state(sdk)
    }
}
