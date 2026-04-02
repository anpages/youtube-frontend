# YTube

Lightweight YouTube frontend. Dark mode, no ads, no recommendations, no autoplay.

## Get a YouTube Data API v3 key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable **YouTube Data API v3** (APIs & Services → Library)
4. Create credentials → **API key** (APIs & Services → Credentials)
5. (Optional but recommended) Restrict the key to `YouTube Data API v3` and your domain

## Run locally

```bash
# 1. Clone / enter the project
cd youtube-frontend

# 2. Install dependencies
npm install

# 3. Set your API key
cp .env.example .env
# edit .env and paste your key

# 4. Start dev server
npm run dev
```

Open http://localhost:5173

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel
# Follow prompts; set VITE_YOUTUBE_API_KEY as an environment variable when asked
```

### Option B — Vercel Dashboard

1. Push this repo to GitHub / GitLab / Bitbucket
2. Import it at [vercel.com/new](https://vercel.com/new)
3. Add the environment variable `VITE_YOUTUBE_API_KEY` in **Project Settings → Environment Variables**
4. Deploy — Vercel auto-runs `npm run build` and serves `dist/`

## API quota notes

Each page load uses:
- **Home**: 1 `videos.list` call (trending)
- **Search**: 1 `search.list` + 1 `videos.list` (for durations)
- **Watch**: 1 `videos.list`

The free daily quota is 10,000 units. Search costs 100 units per call; videos.list costs 1–3 units.
