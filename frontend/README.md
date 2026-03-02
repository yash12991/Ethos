# ETHOS Frontend

Next.js app for the ETHOS anonymous reporting platform. This UI includes the public landing page, reporter authentication flow, reporter dashboard, and HR login/dashboard experience.

## Stack
- Next.js App Router
- React 19
- Tailwind CSS v4 (via @tailwindcss/postcss)
- next-themes for theme support
- lucide-react for icons
- react-hook-form for forms

## Architecture Overview
- App Router pages live under `app/`.
- Shared UI components live under `components/`.
- API calls are defined in `lib/auth-api.ts` and default to the backend at `http://localhost:5000/api/v1`.
- Mock async behavior for signup/login is in `lib/mock-auth.ts` (used by HR login and some flows).

## Routes
- `/` landing page
- `/auth` redirects to `/auth/login`
- `/auth/login` anonymous reporter login
- `/auth/signup` anonymous reporter registration
- `/dashboard` reporter dashboard
- `/hr/login` HR login with OTP step
- `/hr/dashboard` HR dashboard

## Key UI Components
- `ModernBackground` provides layered SVG/gradient background ambience.
- `Grainient` renders the animated WebGL gradient via OGL.
- `Preloader` handles initial hydration fade-in.
- Auth components (`AuthCard`, `PasswordInput`, `RecoveryModal`, `StrengthIndicator`) build the login and signup flows.

## Styling and Motion
- Global theme variables and animation keyframes live in `app/globals.css`.
- Tailwind utilities include `glass`, `text-gradient`, and background grid helpers.
- Custom animations: `blob`, `float`, `pulse-slow`, and `fadeSlideIn`.

## Environment Variables
Create `.env.local` in this folder if you need to point to a different backend.

- `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:5000/api/v1`)

## Running Locally
1. Install dependencies:
	```bash
	npm install
	```
2. Start the dev server:
	```bash
	npm run dev
	```
3. Open `http://localhost:3000`.

## Backend Integration
The reporter login and signup pages call the backend via `lib/auth-api.ts`:
- `POST /auth/register` for signup
- `POST /auth/login` for login

Ensure the backend is running and `NEXT_PUBLIC_API_BASE_URL` matches its origin.

## API Request/Response Examples
Base URL examples assume `http://localhost:5000/api/v1`.

Register (client-side)
```ts
import { registerAnonUser } from "@/lib/auth-api";

await registerAnonUser({
	alias: "Lomira482",
	password: "StrongPass!123",
});
```

Login (client-side)
```ts
import { loginAnonUser } from "@/lib/auth-api";

const response = await loginAnonUser({
	alias: "Lomira482",
	password: "StrongPass!123",
});

const accessToken = response.data?.tokens.accessToken;
```

## Auth Token Storage and Usage
- Tokens are returned by the backend, but the frontend does not store them yet.
- Any authenticated API call should send `Authorization: Bearer <accessToken>`.
- Recommended approach: store access tokens in memory and refresh using HTTP-only cookies.
- Avoid localStorage for sensitive tokens on high-risk clients.

## Deployment Checklist
- Set `NEXT_PUBLIC_API_BASE_URL` to the deployed backend URL.
- Build with `npm run build` and serve with `npm start`.
- Ensure `CLIENT_ORIGIN` on the backend includes the frontend URL.
- Configure CDN and caching for static assets if needed.

## Testing and CI Notes
- No automated tests are included yet.
- Suggested tools: Playwright for UI flows, React Testing Library for components.
- Add CI steps for `npm run lint` and `npm run build` to catch regressions.

## Project Structure
```text
frontend/
├── app/
│   ├── auth/           # reporter auth pages
│   ├── dashboard/      # reporter dashboard
│   ├── hr/             # HR login + dashboard
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── auth/           # auth-specific UI components
│   ├── Grainient.css
│   ├── grainient.tsx
│   ├── modern-background.tsx
│   ├── preloader.tsx
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── lib/
│   ├── auth-api.ts
│   └── mock-auth.ts
├── public/
├── next.config.ts
├── postcss.config.mjs
└── tsconfig.json
```
