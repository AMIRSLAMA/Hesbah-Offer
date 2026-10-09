# Hesbah Offer Mobile Apps

Hesbah Offer has a native Android client (Kotlin + Jetpack Compose) and a native iOS client (SwiftUI). Both use the existing Hesbah Offer REST API; neither creates or migrates server data.

## API URL
The production default is `https://hesbah-server.tail957349.ts.net:8443`.

Android developers can override it with a Gradle property or environment variable:
```bash
gradle assembleDebug -PHESBAH_API_URL=http://10.0.2.2:8090
```
The iOS app reads `HESBAH_API_URL` from its Info.plist, defaulting to the production URL. Change that value only for a deliberate environment change.

## Build Android
```bash
cd mobile
gradle assembleDebug
```
Artifact: `app/build/outputs/apk/debug/app-debug.apk`.

## Build iOS
Open `mobile/ios/HesbahOffer.xcodeproj` in Xcode on macOS, select the HesbahOffer scheme and an iPhone simulator/device, then build. A signed App Store/TestFlight release additionally requires the owner's Apple Developer account and signing configuration.

## Supported flows
- Customer: login/registration, store browsing, products, cash-on-delivery orders, order history.
- Driver: login, assigned-order list, and delivery status transitions.
- Merchant and administrator operations remain in the existing web dashboards.

The mobile apps use the current server and database at port 8090 through the configured HTTPS endpoint. They do not touch the separate Hesbah POS project or its server.