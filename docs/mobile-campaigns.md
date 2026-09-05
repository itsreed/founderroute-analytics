# Installed-app campaign links

After your application's consent manager grants analytics consent, pass an explicit deep link to `setCampaignContext(url)` before recording the destination screen. Swift, Kotlin, and React Native expose the same method.

Only `fr_link`, `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` are retained. The URL itself, query strings containing customer identifiers, and fragments are not recorded. Campaign context is captured on each queued event, so offline delivery preserves the original touch. Withdrawing consent clears the current context. The caller can clear it by passing a URL without campaign parameters.

Use the `fr_link` identifier from a FounderRoute Distribution URL. Call the method from your existing deep-link handler and explicit navigation integration. Do not buffer links observed before consent for later analytics upload. A link received while opted out is ignored.

This supports direct links into an already installed app. It does not connect an anonymous website visit through an app-store installation. Known-user continuity uses the customer-server-signed identity assertion instead.
