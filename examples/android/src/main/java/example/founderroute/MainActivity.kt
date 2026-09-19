package example.founderroute

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import com.founderroute.analytics.FounderRouteAnalytics

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Replace only with a PUBLIC Android test-property key and your collector origin.
        val analytics = FounderRouteAnalytics.init(applicationContext,"fr_pk_REPLACE_WITH_PUBLIC_TEST_KEY","https://collector.example.invalid",packageName,collectionMode="automatic")
        setContent { MaterialTheme { AnalyticsExample(analytics) } }
    }
}
