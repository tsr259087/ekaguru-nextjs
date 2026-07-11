"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import Login from "@/components/Login";
import EkaGuruApp from "@/components/EkaGuruApp";

export default function AuthGate() {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  const [authUnavailable, setAuthUnavailable] = useState(false);

  useEffect(() => {
    if (!auth) {
      // Firebase failed to initialize (see lib/firebase.js's try/catch) — most likely
      // missing/wrong env vars. Don't hang forever waiting for an auth state that
      // will never arrive.
      setAuthUnavailable(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser); // null if signed out, a user object if signed in
    });
    return () => unsubscribe();
  }, []);

  if (authUnavailable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF] px-6">
        <p className="text-sm text-[#8A806C] text-center max-w-sm">
          Couldn't connect to sign-in. This usually means the Firebase configuration
          is missing — check your environment variables and try again.
        </p>
      </div>
    );
  }

  if (user === undefined) {
    // Still waiting on Firebase's first auth check — this resolves quickly (it reads
    // a local cached session), so a brief spinner here is expected and normal.
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF]">
        <Loader2 className="animate-spin text-[#0F6B5C]" size={28} />
      </div>
    );
  }

  if (user === null) {
    return <Login onSignedIn={() => { /* onAuthStateChanged above will pick this up automatically */ }} />;
  }

  return <EkaGuruApp />;
}
