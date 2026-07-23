# Governify Join Frontend

Next.js wizard for onboarding provider projects into Governify. The login-protected root page uses Join Backend's local demo catalog and can restore an onboarding from `?onboarding=<id>`.

Each selected agreement returns a versioned onboarding definition. The wizard renders its integration steps and requirement groups directly from that contract, including dependent resource selectors, single/multiple choices, text, validity, review, and provisioning progress. GitHub uses OAuth-first discovery: existing App installations return directly to a repository selector aggregated across accessible accounts, while users without an installation are forwarded through installation automatically. ZenHub uses explicit demo mocks. Join Backend publishes the completed Scope, Agreement collection and Agreement version, starts an immediate calculation and schedules hourly calculations.

The browser talks only to same-origin Next route handlers. Governify access and refresh tokens remain in secure HTTP-only cookies and external service URLs remain server-side.

## Local development

Copy `.env.example` to `.env.local`, ensure Authenticator and join-backend are running, then:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.
