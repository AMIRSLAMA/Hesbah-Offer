# Hesbah Offer Mobile Apps

This directory contains the native Android client foundation (Kotlin/Jetpack Compose) and the native iOS project.

## Android app variants

The Android module now defines four product flavors, each with a distinct package ID and role lock:

- `customer` — customer shopping, cart, checkout, order history and delivery tracking.
- `merchant` — merchant order workflow and product list.
- `driver` — assigned deliveries, delivery status changes and location service.
- `admin` — platform summary and order oversight.

Build variants from Android Studio by selecting the matching variant:

- `customerDebug`
- `merchantDebug`
- `driverDebug`
- `adminDebug`

The application IDs are `com.hesbah.offer.customer`, `com.hesbah.offer.merchant`, `com.hesbah.offer.driver`, and `com.hesbah.offer.admin`.

## API endpoint

The build reads `HESBAH_API_URL` from a Gradle property or environment variable. The current default is the Tailscale Funnel endpoint for Hesbah Offer on port 8090:

`https://hesbah-server.tail957349.ts.net:8443`

Override it for a local/test server with a Gradle property such as `-PHESBAH_API_URL=https://your-host`. Do not point these apps at the Hesbah main service on port 8080.

## Important release checks

- Confirm the current Tailscale Funnel URL and HTTPS certificate before production release.
- Build and test all four variants against a test account for the matching role.
- Android APKs can be built on a compatible Android/Gradle environment.
- iOS archives and App Store signing require macOS and Xcode. The iOS project still needs the same four role-specific app targets and a release build/test pass before the four-app delivery is complete.
