"use client";

import { doc, setDoc, collection, onSnapshot, query } from "firebase/firestore";
import { db } from "./firebase";

// Student and mentor docs are stored with the Firebase Auth uid as the doc ID,
// so a user's own profile is always at students/{their uid} or mentors/{their uid}.
// This is what the security rules in firestore.rules rely on.

// Public profile: name, district, career interest, language, education level.
// Readable by any signed-in user — mentors need this to see who they're matched with.
export async function saveStudentProfile(uid, data) {
  await setDoc(doc(db, "students", uid), data, { merge: true });
}

// Private data: parent/guardian details, consent, school and teacher/principal contact.
// Readable only by the student themself or an admin — see firestore.rules for enforcement.
// Never merge this into the students/{uid} document — keeping it a separate document
// is what lets Firestore's rules wall it off, since rules can't restrict individual
// fields within one document read.
export async function saveStudentPrivateInfo(uid, data) {
  await setDoc(doc(db, "student_private", uid), data, { merge: true });
}

export async function saveMentorProfile(uid, data) {
  await setDoc(doc(db, "mentors", uid), { ...data, approved: false }, { merge: true });
}

// Live-subscribe to a collection. Call the returned function to unsubscribe (e.g. in a
// React useEffect cleanup). Matching happens server-side in Cloud Functions, so the
// `matches` collection here already reflects the latest auto-match result.
//
// onError matters more than it looks: if nobody is signed in yet, Firestore's security
// rules deny the read, and onSnapshot fires its error path, not its success path. Without
// an onError handler, that failure is silent — onChange never runs, and calling code
// (e.g. a loading spinner waiting for the first snapshot) hangs forever with no signal
// that anything went wrong.
export function subscribeToCollection(name, onChange, onError) {
  const q = query(collection(db, name));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    if (onError) onError(error);
    else console.error(`[EkaGuru] subscribeToCollection("${name}") error:`, error);
  });
}

// Example usage inside the React app:
//
//   useEffect(() => {
//     const unsubStudents = subscribeToCollection("students", setStudents);
//     const unsubMentors = subscribeToCollection("mentors", setMentors);
//     const unsubMatches = subscribeToCollection("matches", setMatches);
//     return () => { unsubStudents(); unsubMentors(); unsubMatches(); };
//   }, []);
