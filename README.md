# AbisoTrack

A working React and TypeScript implementation of the supplied AbisoTrack interface. It is not a wireframe gallery.

## Included workflows

- Local administrator sign-in
- Dashboard with live derived totals
- Create, draft, send, inspect, and close alerts
- Recipient scoping by all contacts or call-tree node
- Contact and call-tree management
- Locally simulated SMS queue entries
- Derived reach reports
- Local settings, user records, and audit history
- Mobile contact sign-in
- Mobile alert viewing and acknowledgment
- Mobile call-tree and profile views
- Responsive layouts

## Storage

There is no database and there are no seeded records. Data created through the interface is saved to browser `localStorage` under `abisotrack-app-v1`.

This is appropriate for local demos and prototyping. It is not suitable for production authentication, multi-device synchronization, or real message delivery.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:4173`.

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## First-use flow

1. Sign in to the administrator workspace with any non-empty local credentials.
2. Add a contact in Contacts.
3. Add a Call Tree node whose name matches the contact's unit.
4. Create and send an alert.
5. Switch to Mobile App and sign in with the saved contact's phone number.
6. Open and acknowledge the alert.
7. Return to the administrator workspace to see the updated reach.
