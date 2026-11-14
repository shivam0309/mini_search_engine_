# Front-end

Next.js (App Router) with plain JavaScript and one CSS file. No UI library, so every part is easy to read and explain.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

## Two ways to run

- **With the back-end:** put `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local` (see `.env.example`) and start the FastAPI server. Search, crawling, the index and evaluation all run in Python.
- **Sample mode:** leave `NEXT_PUBLIC_API_URL` empty. The app answers from 41 built-in sample pages with a small JavaScript copy of the pipeline (`lib/mock/`). Useful for a demo without a server, and how the Vercel deployment runs.

## Where things are

- `app/` — one folder per page. `page.js` is the page; `layout.js` wraps pages. `app/admin/layout.js` sends visitors who aren't signed in to `/login`.
- `components/` — pieces used on several pages. `ResultItem.js` draws one result with its score bar; `components/admin/` holds the dashboard parts.
- `app/globals.css` — all styles. Colours and the Inter font match the project slides.
- `lib/api.js` — every page gets data through this file, from the API or the sample data.
- `lib/token.js`, `lib/session.js` — the admin sign-in token, kept in a cookie.
- `lib/mock/` — sample pages, the JavaScript pipeline and sample dashboard data.
