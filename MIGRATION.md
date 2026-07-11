# Moving EkaGuru to Next.js — step by step

This folder is a working Next.js 14 (App Router) project, already wired to the Firebase
backend from `ekaguru-firebase/`. Everything below explains what was done and what you
need to do to run it.

## What changed from the artifact prototype

| Artifact prototype | Next.js project |
|---|---|
| Single `.jsx` file | `app/` (routing/layout) + `components/EkaGuruApp.jsx` (UI) + `lib/` (Firebase) |
| `window.storage` (demo-only API) | Real Cloud Firestore, via `lib/data.js` |
| Manual load/save | Live `onSnapshot` subscriptions — updates appear automatically |
| No real auth | Expects Firebase Phone Auth to already be signed in (see step 5) |
| Mentor auto-approved client-side | Mentor always starts `approved: false`; an admin approves via the `setMentorApproval` Cloud Function — enforced server-side by `firestore.rules`, not just the UI |

## 1. Install Node.js

You need Node 18.18 or newer. Check with:
```bash
node --version
```
If you don't have it, install via https://nodejs.org (LTS version) or `nvm install --lts`.

## 2. Install dependencies

```bash
cd ekaguru-nextjs
npm install
```

This pulls in Next.js, React, Tailwind, `lucide-react` (icons), and the `firebase` SDK —
all already listed in `package.json`.

## 3. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in the six `NEXT_PUBLIC_FIREBASE_*` values from Firebase Console → Project settings
→ General → Your apps → SDK setup and configuration. These are the same values you used
when setting up `ekaguru-firebase/` earlier — if you already have that project, you're
reusing it, not creating a new one.

**Why `NEXT_PUBLIC_` and not `VITE_`:** Next.js only exposes environment variables to
browser code if they're prefixed `NEXT_PUBLIC_`. Anything without that prefix stays
server-only. This is different from Vite's `VITE_` convention used in the original
Firebase setup guide — `lib/firebase.js` here has already been updated to match.

## 4. Run it locally

```bash
npm run dev
```

Open http://localhost:3000. You should see the EkaGuru homepage. If registration forms
show a "please verify your phone number" toast when you submit, that's expected —
see the next step.

## 5. Add phone login (required before registration works)

The Firestore security rules require `request.auth.uid == studentId` to create a student
or mentor record, so registration now needs a signed-in user first. `lib/auth.js`
(carried over from the Firebase backend setup) already has `sendOtp` / `verifyOtp`
ready to use. You need to build a small login screen that calls them — this wasn't
part of the original request, so it's not wired into `EkaGuruApp.jsx` yet. Minimal shape:

```jsx
"use client";
import { useState } from "react";
import { sendOtp, verifyOtp } from "@/lib/auth";

export default function Login({ onSignedIn }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div>
      <div id="recaptcha-container" />
      {!sent ? (
        <>
          <input placeholder="+91XXXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
          <button onClick={async () => { await sendOtp(phone); setSent(true); }}>Send code</button>
        </>
      ) : (
        <>
          <input placeholder="Enter OTP" value={code} onChange={e => setCode(e.target.value)} />
          <button onClick={async () => { await verifyOtp(code); onSignedIn(); }}>Verify</button>
        </>
      )}
    </div>
  );
}
```
Render this before `EkaGuruApp` in `app/page.js`, gated on `auth.currentUser` being set
(track it with `onAuthStateChanged` from `firebase/auth`).

## 6. Deploy the Cloud Functions backend (if you haven't already)

The frontend depends on the Cloud Functions in `ekaguru-firebase/functions/` for
matching, WhatsApp notifications, and mentor approval. If you haven't deployed those yet,
follow `ekaguru-firebase/README.md` sections 1–5 before testing the full flow — the
Next.js app alone won't match students to mentors without those functions live.

## 7. Deploy the frontend

Next.js's native home is **Vercel** (made by the same team, zero-config):

```bash
npm install -g vercel
vercel
```
Follow the prompts, then add your six `NEXT_PUBLIC_FIREBASE_*` variables in the Vercel
project dashboard under Settings → Environment Variables (same values as `.env.local`).
Every subsequent `git push` to your connected repo auto-deploys.

Netlify also supports Next.js if you'd rather use that — same environment variable
step, different dashboard.

## 8. What's intentionally left as follow-up work

- **Login screen** (step 5) — described above but not built into the UI yet.
- **Admin tab access control** — the Admin tab in `EkaGuruApp.jsx` still shows to anyone
  who clicks it; it should be gated on the signed-in user's `admin` custom claim
  (check `(await auth.currentUser.getIdTokenResult()).claims.admin`) before rendering.
- **Dashboard's "matched pairs" view** currently recomputes matching client-side (the
  same `computeMatches` logic from the prototype) for instant display. The real match
  results live server-side in the `matches` collection, written by the Cloud Function.
  These should agree in practice, but for full correctness the dashboard should
  subscribe to `matches` via `subscribeToCollection("matches", ...)` instead of
  recomputing — a small follow-up change, not done here to keep this migration focused.
- **Google Fonts loading** — currently via `@import` in `globals.css`, which works but
  isn't optimal. Next.js has a built-in `next/font/google` that self-hosts fonts for
  better performance; worth switching to once the app is otherwise stable.
