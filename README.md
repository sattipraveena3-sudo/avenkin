# Avenkin

**Care stays close, even when you aren’t.**

**Live app:** [avenkin.sattipraveena3.workers.dev](https://avenkin.sattipraveena3.workers.dev/)

Avenkin is a full-stack care-coordination web app for adults managing an aging parent’s everyday care from another city or country. It gives the family one shared schedule, simple no-login caregiver check-ins, a chronological timeline, and clear missed-check-in alerts.

> Avenkin coordinates family-entered information. It does not diagnose, prescribe, recommend treatment, or monitor emergencies.

## MVP features

- ChatGPT sign-in for the primary family organiser
- One parent profile with location, timezone, and a configurable alert window
- Medication and appointment scheduling
- Private, shareable check-in links for parents, relatives, and caregivers
- One-tap “taken” and “attended” confirmations with optional notes
- Shared chronological timeline for schedules, check-ins, notes, members, and alerts
- Persistent Cloudflare D1 storage with Drizzle migrations
- Overdue-check-in detection, a secure background runner, and an alert centre
- Opt-in native browser notifications with one-minute dashboard refreshes
- Alert recipient, grace-window preferences, test delivery, and delivery history
- Resend-ready email delivery when production credentials are configured
- Mobile-first, accessible interfaces for both organisers and caregivers

## Product flow

1. The organiser signs in and creates a parent profile.
2. They schedule medications and appointments.
3. Each trusted person receives a private no-login link.
4. A caregiver taps once to confirm a dose or appointment and may add context.
5. The family dashboard updates the shared timeline.
6. Items past the configured grace period become alerts and enter the email queue.

## Stack

- React 19 + Next-compatible Vinext routing
- Cloudflare Workers runtime
- Cloudflare D1 + Drizzle ORM
- TypeScript
- Tailwind CSS entry with a custom responsive design system

## Public URL

The user-facing `workers.dev` address is provided by the small reverse-proxy Worker in [`cloudflare-proxy/worker.js`](cloudflare-proxy/worker.js). It forwards the public Avenkin URL to the full-stack Sites deployment, so the application and API continue to share one backend.

Cloudflare Worker secrets and Avenkin alert credentials are configured in their respective deployment dashboards and are never committed to this repository.

## Local development

Requirements: Node.js 22.13+ and the Cloudflare/Vinext-compatible Linux tooling used by the included scripts.

```bash
npm ci
npm run dev
```

Generate a migration after changing `db/schema.ts`:

```bash
npm run db:generate
```

Quality checks:

```bash
npm run lint
npx tsc --noEmit
```

## Production alert configuration

The dashboard refreshes alert state once a minute while it is open. For checks when nobody has Avenkin open, call `GET` or `POST /api/alerts/run` from a secure hourly scheduler, using either `Authorization: Bearer <ALERT_CRON_SECRET>` or the `?key=<ALERT_CRON_SECRET>` query parameter. Set `ALERT_RUNNER_ACTIVE=true` when that scheduler is active so the alert centre can show the correct status.

Required for the secure background runner:

- `ALERT_CRON_SECRET`

Required for outbound email:

- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL` (a verified Resend sender)

Without email credentials, overdue events are still recorded in the shared timeline and notification queue.

## Data model

The initial migration creates `families`, `members`, `care_items`, `timeline_entries`, and `notifications`. Share links use random opaque tokens and never expose the organiser’s authenticated dashboard.

## Scope boundary

Avenkin deliberately excludes diagnosis, prescriptions, treatment recommendations, insurance workflows, device integrations, and emergency-response claims. Those are outside the coordination-only MVP.
