# RicozSpend client

## API configuration

All browser API requests use the single `VITE_API_URL` setting in
`src/api/client.js`.

- Local development: `Client/.env.development` sets `VITE_API_URL=http://localhost:5000`.
- Vercel production: set `VITE_API_URL` in the Vercel project environment to
the public Render service origin, for example
`https://<your-render-service>.onrender.com`. Do not add `/api` and do not
use a trailing slash.

The production build stops with a clear configuration error if `VITE_API_URL`
is absent, rather than silently sending API requests to a visitor's localhost.

The Render service must also set `CLIENT_URL` to the exact Vercel production
origin, for example `https://<your-vercel-project>.vercel.app`. If more than
one frontend origin must be allowed, provide comma-separated origins.