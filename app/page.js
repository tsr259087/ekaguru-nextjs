import LandingPage from "@/components/LandingPage";

// The landing page reads public Firestore stats (student/mentor/match counts,
// per-subject coverage) — nothing sensitive, but still live data, so this stays
// dynamic rather than statically prerendered at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return <LandingPage />;
}
