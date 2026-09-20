# AbisoTrack shared demo

A working React, TypeScript, and Supabase alert-tracking system based on the supplied AbisoTrack interface.

## Working features

- Real administrator email/password authentication
- Shared cloud database with no seeded sample records
- Contact creation with hashed student demo PINs
- Call-tree management
- Draft, send, inspect, and close alerts
- Stable recipient snapshots for historical reporting
- Student phone/PIN sign-in with expiring sessions
- Cross-device alert viewing and acknowledgement
- Live administrator updates when data changes
- Reports, settings, users, audit history, and responsive layouts
- Real SMS queue with Android phone-and-SIM gateway status tracking
- Simulated email delivery

## Technology

- React 18 and TypeScript
- Vite
- Supabase Postgres, Authentication, database functions, Row Level Security, and Realtime
- GitHub Pages deployment workflow
- Native Android SMS gateway (Java, no third-party runtime libraries)

## Setup

Follow [SETUP.md](SETUP.md). The database definition is in `supabase/schema.sql` and the required browser variables are listed in `.env.example`.

## Commands

```bash
npm install
npm run dev
npm run build
npm test
```

## Security scope

This is a demo-ready system, not a production emergency-notification service. It separates administrator authentication from student phone/PIN sessions and never exposes a Supabase secret/service-role key. Full RBAC, provider-grade delivery guarantees, inbound SMS acknowledgements, and production incident controls remain outside the demo scope. The Android gateway sends only to contacts whose consent checkbox is enabled and spaces small batches to reduce accidental carrier abuse.
