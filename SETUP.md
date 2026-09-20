# AbisoTrack shared demo setup

This build uses GitHub Pages for the React interface, Supabase for authentication and shared data, and an optional Android phone-and-SIM gateway for real outgoing SMS. It includes no sample records. Email remains simulated.

## 1. Create the Supabase project

1. Sign in at https://supabase.com/dashboard and create a project.
2. Wait until the project is ready.
3. Open **SQL Editor**, create a new query, paste all of `supabase/schema.sql`, and click **Run**.
4. Open **Authentication → Users → Add user**.
5. Create the administrator email/password account and enable **Auto Confirm User**.

Do not place the database password, secret key, or service-role key in this application.

## 2. Get the browser-safe connection values

In **Project Settings → API Keys**, copy:

- Project URL
- Publishable key

The application needs only these browser-safe values.

## 3. Run locally

Copy `.env.example` to `.env.local` and fill in the two values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Then run:

```powershell
npm install
npm run dev
```

## 4. Configure GitHub Pages

In the GitHub repository:

1. Open **Settings → Secrets and variables → Actions → Variables**.
2. Add `VITE_SUPABASE_URL` with the Supabase Project URL.
3. Add `VITE_SUPABASE_PUBLISHABLE_KEY` with the publishable key.
4. Open **Settings → Pages** and select **GitHub Actions** as the source.
5. Push this project to the `main` branch. The included deployment workflow builds and publishes the site.

## 5. Enable the Android SMS gateway

If the original database schema was installed before the gateway was added, run all of `supabase/migrations/20260921_sms_gateway.sql` once in the Supabase SQL Editor.

1. In **Supabase → Authentication → Users**, create a separate gateway email/password account and enable **Auto Confirm User**.
2. Open `android-gateway` in Android Studio.
3. Copy `gateway.properties.example` to `gateway.properties` and enter the same project URL and publishable key used by the website. Never enter a secret/service-role key.
4. Build and install the APK on the dedicated Android phone.
5. Make the Globe SIM the phone's default SMS SIM.
6. Open the gateway, allow notifications and SMS, enter the gateway account, and press **Sign in and start gateway**.
7. Disable battery optimization for the gateway app during the demonstration.

The gateway claims at most five queued messages at once and waits four seconds between sends. Only contacts with **Consent recorded** are added to the SMS queue.

## 6. Demonstrate the system

1. Sign in to the administrator workspace with the Supabase administrator account.
2. Add a contact and assign a 4–8 digit demo PIN.
3. Add a call-tree node whose name matches the contact's unit.
4. Create and send an alert.
5. Open the mobile workspace in another browser or private window.
6. Sign in with the contact's phone number and PIN.
7. Acknowledge the alert.
8. Return to the administrator alert detail. The acknowledgement updates through the shared database.

## What is real and what is simulated

Real in this demo:

- Administrator email/password authentication
- Shared contacts and call tree
- Shared alerts and recipient snapshots
- Student phone/PIN sessions
- Cross-device acknowledgement tracking
- Reports, settings, and audit entries
- Live administrator updates

Requires the Android gateway:

- Outgoing SMS through the installed SIM
- Sent, delivered (when the carrier provides a receipt), and failed status updates

Simulated or outside this demo:

- Email delivery
- Inbound SMS replies
- Advanced role-based permissions
