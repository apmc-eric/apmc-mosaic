# Custom production domain

The app builds auth redirect URLs from the **current browser origin** (for example `window.location.origin` on the login page and `/auth/callback`). **You do not need to change application code** when you add a domain—only hosting and provider dashboards.

Replace `https://app.example.com` below with your real HTTPS URL (no trailing slash).

---

## 1. Hosting (e.g. Vercel)

1. In your host’s project settings, **add the custom domain** and complete DNS (A/CNAME) as instructed.
2. Wait until the site loads reliably at `https://app.example.com` with a valid certificate.

---

## 2. Supabase (required for sign-in)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL configuration**.
2. Set **Site URL** to:  
   `https://app.example.com`
3. Under **Redirect URLs**, ensure these are listed (add each on its own line if missing):
   - `https://app.example.com/auth/callback`
   - `http://localhost:3000/auth/callback` (optional, for local dev)
   - Any **preview** URLs you use (e.g. `https://*.vercel.app/auth/callback` if your Supabase plan supports wildcards—otherwise add explicit preview URLs).

If the callback URL is not allowed, magic links and OAuth will fail after redirect.

---

## 3. Google sign-in (only if you use Google OAuth)

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your **OAuth 2.0 Client ID**.
2. **Authorized redirect URIs** must include Supabase’s callback (not your app’s domain), typically:  
   `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`  
   (Copy the exact value from Supabase → **Authentication** → **Providers** → **Google** if shown.)
3. If Google asks for **Authorized JavaScript origins**, add:  
   `https://app.example.com`  
   and `http://localhost:3000` for local testing if needed.

---

## 4. Environment variables (production)

Set the same variables your app already uses; the **site domain does not replace** `NEXT_PUBLIC_SUPABASE_URL` (that stays your Supabase project URL). See **`.env.example`** in the repo root for names and short descriptions.

---

## 5. Workspace email rules (optional)

- **Settings → General** (`allowed_domains` in `settings`) and **Settings → Mosaic → Domains** (`whitelisted_domains` in `workspace_settings`) control **which email domains can sign up / get roles**—they are **not** the URL users type in the browser. Add your company mail domain there if policy requires it.

---

## 6. Dev-only login

`ALLOW_DEV_LOGIN` / dev-login API is restricted to **localhost** by design. Do not rely on it in production on your custom domain.

---

## Troubleshooting: sent to localhost after sign-in

1. **Supabase Site URL** must be your real app (e.g. `https://mosaic.apmc.design`), not `http://localhost:3000`. If it is still localhost, some redirects or older email templates can pick that up.

2. **Magic links** embed the redirect that was active when the link was **requested**. If you requested a link from localhost, the email points at localhost. Request a **new** link from **`https://mosaic.apmc.design/login`**.

3. **`next` query param**: If `/auth/callback?next=http://localhost:3000/...` appears in the address bar, something upstream added a full localhost URL. The app now ignores cross-origin `next` and stays on your current host; fix **Site URL** and **Redirect URLs** in Supabase so new sessions never receive a bad `next`.
