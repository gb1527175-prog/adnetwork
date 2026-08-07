# AdNetX — Publisher Ad Network Platform

A modern, mobile-first ad network platform (landing page, publisher dashboard,
admin panel) built with plain HTML/CSS/JS + Firebase. No build step required —
open the files directly or deploy as static hosting.

## What's fully working out of the box

- Landing page (hero, live stats ticker, features, pricing, FAQ, contact form)
- Firebase Authentication: email/password, Google login, email verification, password reset
- Publisher dashboard: KPI cards, earnings/CTR charts, ad-unit code generator with copy button
- Withdrawal requests (UPI / PayPal / Bank Transfer) written to Firestore
- Support tickets, referral link, profile settings
- Admin panel: user list + block/unblock, ad campaign CRUD, pending-payment approval, site settings
- Firestore & Storage security rules (role-based)
- SEO: meta tags, Open Graph, Twitter Cards, robots.txt, sitemap.xml, JSON-LD
- Dark mode, glassmorphism UI, responsive down to mobile
- Basic PWA (manifest.json + service worker for offline shell)

## What still needs a real backend (by design — static hosting can't do this)

- **Ad serving**: the `<iframe src="https://your-domain.example/ad/...">` embed
  codes assume you'll stand up an actual ad-serving endpoint (Cloud Function,
  Cloud Run, or similar) that returns creative and logs impressions/clicks.
  This project generates correct embed codes and a Firestore schema for the
  data (`users/{uid}/stats/{date}`), but does not include an ad server.
- **Payment execution**: withdrawal *requests* are captured and admins can
  mark them "paid" in the panel, but no money actually moves — integrate a
  payment gateway (Razorpay, Stripe, PayPal Payouts API) via a Cloud Function.
- **Device/country/live-visitor analytics**: shown with clearly-labeled demo
  data until your ad server starts logging real events into Firestore.
- **Multi-language**: the UI is English-only; add i18n (e.g. i18next) if needed.
- **Contact form email**: messages are saved to Firestore; wire a Cloud
  Function trigger (or a service like SendGrid) if you want actual emails.

## Project structure

```
/index.html                 Landing page
/auth/login.html            Login (email + Google)
/auth/register.html         Register + email verification
/auth/forgot-password.html  Password reset
/dashboard/index.html       Publisher dashboard overview
/dashboard/ad-units.html    Ad code generator (300x250, 728x90, 160x600, 320x50, native, responsive)
/dashboard/earnings.html    Daily/monthly earnings
/dashboard/analytics.html   Device/country/CTR charts
/dashboard/payments.html    Withdrawal requests + history
/dashboard/referrals.html   Referral link + stats
/dashboard/support.html     Support tickets
/dashboard/settings.html    Profile settings
/admin/index.html           Admin panel (users, ads, revenue, payments, settings)
/js/firebase-config.js      Your Firebase project keys go here
/js/auth.js                 Auth logic (register/login/google/reset/guard)
/js/dashboard.js            Shared dashboard chrome, charts, ad-code builder
/js/admin.js                Admin panel logic
/js/main.js                 Landing page interactions
/css/style.css              Full design system
/firestore.rules            Firestore security rules
/storage.rules               Storage security rules
/robots.txt, /sitemap.xml   SEO
/manifest.json, /sw.js      PWA
```

## 1. Firebase setup

1. Go to the [Firebase console](https://console.firebase.google.com) → **Create project**.
2. **Build → Authentication → Sign-in method**: enable **Email/Password** and **Google**.
3. **Build → Firestore Database**: create in production mode, any region.
4. **Build → Storage**: enable (default bucket is fine).
5. **Project settings → General → Your apps → Web app (</> icon)**: register
   an app and copy the config object.
6. Paste those values into `js/firebase-config.js`.
7. Deploy the rules (requires the [Firebase CLI](https://firebase.google.com/docs/cli)):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore storage   # point at this folder, keep existing rules files
   firebase deploy --only firestore:rules,storage
   ```
8. To make your first admin account: sign up normally through the site, then
   in the Firestore console open `users/{your-uid}` and change `role` from
   `"publisher"` to `"admin"`. Reload `/admin/index.html`.

## 2. Run locally

No build tools needed — any static server works:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## 3. Deploy

### Option A — Firebase Hosting (recommended, works with the same project as Auth/Firestore)
```bash
firebase init hosting     # public directory: . (project root)
firebase deploy --only hosting
```

### Option B — GitHub Pages
1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Source**: deploy from the `main` branch, root folder.
3. Your Firebase Authentication **Authorized domains** (Authentication →
   Settings → Authorized domains) must include your `*.github.io` domain,
   or login/register will fail.
4. GitHub Pages serves everything statically — Firebase Auth/Firestore/Storage
   calls still work fine since they're client-side API calls.

### Before going live
- Replace every `your-domain.example` placeholder (ad embed codes, sitemap,
  Open Graph tags) with your real domain.
- Replace `/assets/favicon.svg` and add real `icon-192.png` / `icon-512.png`
  for the PWA manifest.
- Tighten `firestore.rules` further if you add new collections.
- Set a real minimum-withdrawal check and payout automation before accepting
  real publisher traffic — right now withdrawal approval is manual.

## Customization

- **Colors/fonts**: everything is driven by CSS variables at the top of
  `css/style.css` (`--ink`, `--signal`, `--mint`, etc.) — change once, it
  cascades everywhere including dark mode.
- **Ad sizes**: edit the `AD_SIZES` array in `js/dashboard.js`.
- **Pricing tiers / FAQ copy**: edit directly in `index.html`.
