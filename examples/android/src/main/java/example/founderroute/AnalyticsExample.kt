package example.founderroute
import androidx.compose.runtime.*
import androidx.compose.material3.*
import androidx.compose.foundation.layout.Column
import com.founderroute.analytics.FounderRouteAnalytics
import java.util.UUID

@Composable fun AnalyticsExample(analytics:FounderRouteAnalytics) {
    Column {
        Button(onClick={analytics.screen("Editor")}){Text("Open editor")}
        Button(onClick={analytics.track("document_published",outcomeId=UUID.randomUUID().toString())}){Text("Publish")}
        Button(onClick={analytics.reset()}){Text("Log out")}
    }
}
// Initialize once in Application.onCreate with the Android test property's public key.
// In a Navigation Compose app, observe currentBackStackEntryAsState and call screen(route)
// from LaunchedEffect(route), using route templates rather than route arguments.
