# Deploy to Vercel — checklist

This package has already been checked for the two issues you hit before:
- `next` is pinned to `14.2.35` (patched version, not the vulnerable `14.2.5`)
- `jsconfig.json` is included so `@/components/...` and `@/lib/...` imports resolve

## 1. Unzip it

```bash
unzip ekaguru-nextjs.zip
cd ekaguru-nextjs
```

Confirm `package.json` is directly inside this folder (not one level down):
```bash
ls
# should show: app  components  jsconfig.json  lib  MIGRATION.md  package.json  ...
```

## 2. Push to GitHub — from inside this folder, not its parent

This is what caused the "Root Directory" problem last time — make sure your terminal
is `cd`'d into `ekaguru-nextjs` itself before running these:

```bash
git init
git add .
git commit -m "EkaGuru Next.js app"
```
Create a new empty repo on GitHub (github.com/new — don't initialize it with a README),
then:
```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

## 3. Import into Vercel

1. vercel.com/dashboard → **Add New… → Project**
2. Select the GitHub repo you just pushed
3. **Leave Root Directory blank** this time — since you pushed from inside
   `ekaguru-nextjs`, its contents (including `package.json`) are already at the repo
   root, so Vercel will find them automatically. (Root Directory is only needed when
   the app lives in a *subfolder* of the repo — that's what went wrong before.)
4. Framework Preset should auto-detect as **Next.js** — leave it as is

## 4. Add environment variables

Still on the import screen (or Settings → Environment Variables afterward), add these
six, using your real Firebase project's values from Firebase Console → Project settings
→ General → Your apps → SDK setup:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

## 5. Deploy

Click **Deploy**. Build should complete without the earlier two errors.

## If it still fails

Paste the new build log — but check these first:
- Did `ls` in step 1 show `package.json` directly (not inside another folder)?
- Are all six env vars added, with no typos in the variable names?
- Does your Firebase project actually have Firestore and Phone Auth enabled yet
  (see `ekaguru-firebase/README.md` steps 1–3)? A missing backend won't fail the
  *build*, but the deployed site will show connection errors when used.

## After it's live

The site will load, but registration won't work yet — there's no login screen wired in.
See `MIGRATION.md` section 5 for what's needed there next.
