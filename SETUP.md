# AbisoTrack shared demo setup

This build uses GitHub Pages for the React interface and Supabase for authentication and shared data. It includes no sample records. SMS and email are demo logs only and do not contact external providers.

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

## 5. Demonstrate the system

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

Simulated:

- SMS delivery
- Email delivery
- Advanced role-based permissions
