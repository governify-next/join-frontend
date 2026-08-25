# Governify Join Frontend

Next.js wizard for onboarding provider projects into Governify. The login-protected root page uses Join Backend's local demo catalog and can restore an onboarding from `?onboarding=<id>`.

Each selected agreement returns a versioned onboarding definition. The wizard renders one main step per external integration and presents that module's requirement groups as progressive internal sub-steps. GitHub becomes `Connect → Repository → Project → Members`, omitting sub-steps not required by the selected agreement. It uses OAuth-first discovery: existing App installations return directly to Repository, while users without an installation are forwarded through installation automatically. The remaining guided fields include dependent resource selectors, single/multiple choices, text, validity, review, and provisioning progress. ZenHub uses explicit demo mocks. Join Backend publishes the completed Scope, Agreement collection and Agreement version, starts an immediate calculation and schedules hourly calculations.

The browser talks only to same-origin Next route handlers. Governify access and refresh tokens remain in secure HTTP-only cookies and external service URLs remain server-side. A rejected access token triggers one coordinated refresh and request retry; if the refresh token is no longer valid, Join clears the session and returns the user to login while preserving the onboarding URL.

## Local development

Copy `.env.example` to `.env.local`, ensure Authenticator and join-backend are running, then:

```bash
npm ci
npm run dev
```

The standalone join-backend default is `http://localhost:5907`. Open the frontend at `http://localhost:3000`.
