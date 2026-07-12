import AuthGate from "@/components/AuthGate";

// This page depends entirely on live client-side Firebase (auth, Firestore) — there's
// nothing meaningful to pre-render at build time, and attempting to do so runs
// EkaGuruApp's Firebase initialization in Vercel's Node build environment, where
// real env vars/browser context aren't available the same way. Forcing dynamic
// rendering skips build-time prerendering and renders this page per-request instead.
export const dynamic = "force-dynamic";

// AuthGate (a client component) decides whether to show Login or EkaGuruApp
// based on whether Firebase reports a signed-in user. This used to live at the
// root route ("/") — moved here so the root can be the public marketing landing
// page instead (see components/LandingPage.jsx).
export default function AppPage() {
  return <AuthGate />;
}
