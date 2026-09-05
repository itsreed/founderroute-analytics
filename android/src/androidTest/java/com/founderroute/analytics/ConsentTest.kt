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
        val sdk=FounderRouteAnalytics.init(context,"fr_pk_fixture_consent","https://collector.example","example.fixture")
        sdk.setConsent(false); sdk.track("before_consent"); sdk.flush()
        val complete=CountDownLatch(1)
        sdk.getDiagnostics { result -> assertFalse(result.getBoolean("consent"));assertEquals(0,result.getInt("queued"));assertTrue(result.isNull("anonymousId"));complete.countDown() }
        assertTrue(complete.await(5,TimeUnit.SECONDS))
    }
}
