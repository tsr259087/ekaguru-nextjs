import AuthGate from "@/components/AuthGate";

// This page depends entirely on live client-side Firebase (auth, Firestore) — there's
// nothing meaningful to pre-render at build time, and attempting to do so runs
// EkaGuruApp's Firebase initialization in Vercel's Node build environment, where
// real env vars/browser context aren't available the same way. Forcing dynamic
// rendering skips build-time prerendering and renders this page per-request instead.
export const dynamic = "force-dynamic";

// This page itself is a server component (the Next.js App Router default).
// AuthGate (a client component) decides whether to show Login or EkaGuruApp
// based on whether Firebase reports a signed-in user.
export default function Home() {
  return <AuthGate />;
}
