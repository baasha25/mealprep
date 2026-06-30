# PrepFlow — Demo

An all-in-one meal-prep business platform demo (storefront, customer app, POS, kitchen OS, delivery routes, marketing, staff scheduling). Single-page React app — no backend, all data is in-memory and resets on reload.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173).

## Build

```bash
npm run build      # outputs to /dist
npm run preview    # preview the production build locally
```

## Deploy to Netlify

### Option A — Connect GitHub (recommended)
1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project → GitHub**, pick the repo.
3. Netlify reads `netlify.toml` automatically:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy. You get a free `your-site-name.netlify.app` link. No custom domain needed.

### Option B — Drag and drop (no GitHub)
1. Run `npm install && npm run build` locally.
2. In Netlify: **Add new site → Deploy manually**.
3. Drag the generated **`dist`** folder onto the page. You get a live link in seconds.

## Tech
- React 18 + Vite
- Tailwind CSS 3
- recharts (charts), lucide-react (icons)
- Fonts (Inter + Fraunces) load from Google Fonts at runtime

## Notes
- This is a front-end demo only: no real payments, auth, database, email, or SMS.
- The whole app lives in `src/App.jsx`.
