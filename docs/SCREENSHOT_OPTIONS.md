# Screenshot options for link inspo

When users submit a URL, the app can capture a **full-page screenshot** either via **ScreenshotOne** (third-party API) or **self-hosted capture** (Puppeteer + Vercel Blob). Assets from self-hosted capture are stored and served from your own storage (no third-party link), similar to [Godly](https://godly.website/).

---

## How Godly-style capture works

Sites like [Godly](https://godly.website/) show previews (and sometimes **videos** of pages) without exposing a third-party URL because they:

1. **Run their own capture pipeline** — When a site is added, a worker or API runs a headless browser (Puppeteer/Playwright), loads the URL, and captures:
   - a **full-page screenshot** (PNG/JPEG), and/or  
   - a **short video** (e.g. record the viewport while the page loads or scrolls — Playwright supports `recordVideo` on the browser context).
2. **Upload to their storage** — The resulting file is uploaded to their CDN/storage (S3, Vercel Blob, etc.).
3. **Serve from their domain** — The app stores only their own asset URL/path (e.g. `/api/file?pathname=...` or `cdn.example.com/...`), so the browser never loads a third-party screenshot service.

**Videos** are usually either: (a) Playwright’s built-in `recordVideo` while loading/scrolling the page, or (b) capture frames (screenshots) while scrolling and stitch them into a video with ffmpeg. Option (a) is simpler; (b) gives more control (e.g. scroll speed).

This repo implements **self-hosted screenshot** via `/api/capture`: Puppeteer + `@sparticuz/chromium` (for Vercel serverless) captures a full-page PNG, uploads it to Vercel Blob, and returns the pathname. The same file is used for the grid (16:9 crop in CSS) and the detail view. No third-party screenshot URL is stored. Adding **video** would mean enabling `recordVideo` in the browser context and uploading the WebM/MP4 to Blob the same way.

---

## Current implementation

- **ScreenshotOne only:** [ScreenshotOne](https://screenshotone.com/) — one full-page capture per URL; preview uses the same image in a 16:9 top-center crop. Signed URLs keep the API key server-side.

**Option A – ScreenshotOne (hosted API)**  
Set in `.env.local`:

```bash
SCREENSHOTONE_ACCESS_KEY=your_access_key
SCREENSHOTONE_SECRET_KEY=your_secret_key
```

Get keys at [ScreenshotOne Dashboard](https://dash.screenshotone.com/). Free tier available. Screenshot URLs are signed and point at ScreenshotOne; the image is loaded from their CDN.

**Option B – Self-hosted capture (no third-party link)**  
When `USE_SELF_HOSTED_CAPTURE=true`, “Grab Screenshot” and “Refresh screenshot” use `/api/capture` first (fallback to ScreenshotOne if 503 or failure): Puppeteer + Chromium runs in your environment, takes a full-page screenshot, uploads it to **Vercel Blob**, and returns a pathname. Assets are served from your app via `/api/file?pathname=...` — no external screenshot URL is stored.

Requires `puppeteer-core` and `@sparticuz/chromium` (already in the repo). On Vercel, the capture route uses `maxDuration = 60`.

- **Vercel:** Uses `@sparticuz/chromium` automatically.
- **Local dev (e.g. macOS):** Uses system Chrome if present (`Google Chrome` or `Chromium` in `/Applications`), or set `PUPPETEER_EXECUTABLE_PATH` to your Chrome/Chromium binary.

Set:

```bash
USE_SELF_HOSTED_CAPTURE=true
```

---

## Alternatives and GitHub repos

### 1. Screenshot APIs (hosted, no server to run)

| Service | Notes |
|--------|--------|
| [ScreenshotOne](https://screenshotone.com/) | Used in this app when keys are set. Full-page, viewport control, optional ad/cookie blocking. |
| [Urlbox](https://urlbox.io/) | Paid, fast, many options. |
| [ApiFlash](https://apiflash.com/) | Chrome-based, full-page. |
| [Screenshotmachine](https://www.screenshotmachine.com/) | Simple API. |

### 2. Self-hosted (Node + headless browser)

Run your own screenshot service and call it from the app (or run Playwright/Puppeteer in a worker/queue).

| Repo | Stack | Notes |
|------|--------|--------|
| [sindresorhus/capture-website](https://github.com/sindresorhus/capture-website) | Puppeteer | Simple API, full-page, lazy-load, PNG/JPEG/PDF. |
| [morteza-fsh/puppeteer-full-page-screenshot](https://github.com/morteza-fsh/puppeteer-full-page-screenshot) | Puppeteer | Dedicated full-page capture. |
| [h-will-h/fullpage-puppeteer-screenshot](https://github.com/h-will-h/fullpage-puppeteer-screenshot) | Puppeteer | “Better” full-page (handles tall pages). |
| [FireChatbot/fullpage-screenshots](https://github.com/FireChatbot/fullpage-screenshots) | puppeteer-core + sharp | Scroll-and-stitch, good for serverless. |
| [AlexanderDuya/WebSnapShot](https://github.com/AlexanderDuya/WebSnapShot) | Node | Full-page including scroll-triggered content. |

**Playwright** (no separate repo needed):

- [Playwright screenshots](https://playwright.dev/docs/screenshots) — `page.screenshot({ fullPage: true })`.
- Use in a separate service or background job; avoid heavy browser in short-lived serverless.

### 3. Flow you want

- **Preview (grid):** 16:9 crop — e.g. viewport 1440×810 or crop after capture.
- **Full view (detail):** Single long image — `fullPage: true` (Playwright/Puppeteer) or API’s full-page option.

This app returns two URLs from `/api/screenshot`: one for preview (16:9) and one for full page. The detail panel and post page show the long screenshot in a “Full page” section when `full_screenshot_url` is stored. To persist it, run the migration:

```bash
# In Supabase SQL editor or your migration flow
# scripts/008_add_full_screenshot_url.sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS full_screenshot_url TEXT;
```
