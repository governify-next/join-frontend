# Governify Join Frontend

Next.js wizard for onboarding provider projects into Governify. `/github` uses Registry's public agreement templates with GitHub Projects V2 and can restore an onboarding from `?onboarding=<id>`.

The current selectable agreement is a four-metric projection of Registry's public `CS169L-Sp26` Swagger example.

The browser talks only to same-origin Next route handlers. Governify access and refresh tokens remain in secure HTTP-only cookies and external service URLs remain server-side.

## Local development

Copy `.env.example` to `.env.local`, ensure Authenticator and join-backend are running, then:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000/github`.
