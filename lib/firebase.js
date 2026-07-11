// Client-side Firebase setup for Next.js.
// Next.js only exposes env vars prefixed NEXT_PUBLIC_ to the browser — unprefixed
// vars stay server-only. Since this file runs in the browser, every value here
// needs that prefix. Set these in .env.local (see .env.local.example).
"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  // A missing key here surfaces later as a cryptic "auth/invalid-api-key" error deep
  // in Firebase's internals. This makes the real cause obvious immediately: either
  // .env.local is missing/incomplete locally, or the NEXT_PUBLIC_FIREBASE_* variables
  // haven't been added in your deploy platform's project settings.
  console.warn(
    "[EkaGuru] NEXT_PUBLIC_FIREBASE_API_KEY is not set. Firebase will fail to initialize. " +
    "Check .env.local (local dev) or your deploy platform's environment variables (production)."
  );
}

// This runs at module load time — before any React component renders — so a thrown
// error here would crash the entire page with Next.js's generic "Application error"
// screen, bypassing our custom error boundary in EkaGuruApp.jsx entirely. Wrapping it
// means: worst case, auth/db/functions are undefined and individual features fail
// with a catchable error inside a component (where our error boundary DOES apply),
// instead of the whole app going blank.
let app, auth, db, functions;
try {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
} catch (e) {
  console.error(
    "[EkaGuru] Firebase failed to initialize. Check your NEXT_PUBLIC_FIREBASE_* " +
    "environment variables are set and correct.",
    e
  );
}

export { app, auth, db, functions };
