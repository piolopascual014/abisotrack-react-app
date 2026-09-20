# AbisoTrack SMS Gateway

This Android app turns one dedicated Android phone and its active SIM into the outgoing SMS gateway for AbisoTrack. It does not need to be the phone's default messaging app, but the intended Globe SIM must be selected as the default SMS subscription.

## Safety and scope

- The gateway starts only after the operator opens the app and presses the start button.
- It requests internet, notification, foreground-service, SMS-send, and SMS-receive permissions.
- It reads only incoming SMS broadcasts needed to recognize the exact reply `1`; it does not read message history, contacts, call logs, or device files.
- It sends only queue entries created for contacts with recorded consent.
- Each batch contains at most five messages with four seconds between sends.
- A queue item is attempted at most three times.
- This direct-install APK is for a controlled demonstration, not high-volume production broadcasting.

## Configure

1. Copy `gateway.properties.example` to `gateway.properties`.
2. Set `SUPABASE_URL` to the project URL.
3. Set `SUPABASE_PUBLISHABLE_KEY` to the browser-safe publishable key.
4. Never use a Supabase secret or service-role key.
5. Run `supabase/migrations/20260921_sms_gateway.sql` in the Supabase SQL Editor.
6. Create a separate confirmed user in Supabase Authentication for the gateway.

## Build in Android Studio

1. Open the `android-gateway` directory.
2. Let Gradle finish synchronizing.
3. Select **Build → Build APK(s)**.
4. Install the generated debug APK from `app/build/outputs/apk/debug/app-debug.apk` on the gateway phone.

## Run

1. Insert the registered Globe SIM.
2. Set that SIM as the default for SMS if the phone is dual-SIM.
3. Keep Wi-Fi or mobile data connected.
4. Open AbisoTrack SMS Gateway and grant its permissions.
5. Sign in with the dedicated gateway account and start it.
6. Keep its persistent notification visible.
7. In the web administrator app, create an alert, select **SMS**, and send it.
8. A recipient may reply **1** to acknowledge their latest active alert without signing in to the web app.

The web SMS Logs screen updates from queued to sending, sent, delivered, or failed. Some carriers do not return a delivery receipt; in that case a successfully handed-off message remains `sent`.
