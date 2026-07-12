"use client";

import { doc, setDoc, collection, onSnapshot, query, where, getDocs, getCountFromServer } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { CAREER_AREAS } from "./constants";

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

// Mentor verification details not meant for public display (LinkedIn profile, etc.).
// Kept separate from the public mentor profile for the same reason student private
// data is split out — see firestore.rules for the actual enforcement.
export async function saveMentorPrivateInfo(uid, data) {
  await setDoc(doc(db, "mentor_private", uid), data, { merge: true });
}

// Ends a mentorship — callable by the student themself, their matched mentor, or an
// admin (enforced server-side in the Cloud Function, not here). Frees the mentor's
// capacity on the next matching pass while preserving the match record for history.
export async function completeMentorship(studentId) {
  const fn = httpsCallable(functions, "completeMentorship");
  return fn({ studentId });
}

// Submits end-of-mentorship feedback. role is "student" or "mentor" — whichever side
// is submitting. rating is 1-5, comment is optional free text.
export async function submitFeedback({ studentId, role, rating, comment }) {
  const fn = httpsCallable(functions, "submitFeedback");
  return fn({ studentId, role, rating, comment });
}

// Records an audit log entry (IP captured server-side — see functions/index.js).
// Call explicitly at points worth auditing; not automatic on every action.
// action: a short string like "student_registered", "mentorship_completed".
// metadata: optional extra context, e.g. { careerInterest: "Medicine" }.
export async function logAuditEvent(action, metadata) {
  const fn = httpsCallable(functions, "logAuditEvent");
  return fn({ action, metadata });
}

// Live counts for the public landing page. Uses getCountFromServer rather than
// downloading full documents, since a landing page visitor (possibly not even
// signed in yet) only needs the numbers, not the underlying records.
export async function getPublicStats() {
  const [studentsCount, mentorsCount, matchesCount] = await Promise.all([
    getCountFromServer(collection(db, "students")),
    getCountFromServer(query(collection(db, "mentors"), where("approved", "==", true))),
    getCountFromServer(collection(db, "matches")),
  ]);
  return {
    students: studentsCount.data().count,
    mentors: mentorsCount.data().count,
    matched: matchesCount.data().count,
  };
}

// Real per-subject mentor coverage, for the landing page's tile grid — mirrors the
// same "open"/"full"/"none" logic used inside the app itself (see EkaGuruApp.jsx's
// interestAvailability), just computed once here rather than as a live subscription,
// since a marketing page doesn't need second-by-second freshness.
export async function getCareerInterestCoverage() {
  const [mentorsSnap, matchesSnap] = await Promise.all([
    getDocs(query(collection(db, "mentors"), where("approved", "==", true))),
    getDocs(collection(db, "matches")),
  ]);
  const mentors = mentorsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const matches = matchesSnap.docs.map((d) => d.data());

  const loadByMentorId = {};
  matches.forEach((m) => {
    loadByMentorId[m.mentorId] = (loadByMentorId[m.mentorId] || 0) + 1;
  });

  const coverage = {};
  CAREER_AREAS.forEach((area) => {
    const hasOpenMentor = mentors.some(
      (m) => m.expertise?.includes(area) && (loadByMentorId[m.id] || 0) < m.maxMentees
    );
    const hasAnyMentor = mentors.some((m) => m.expertise?.includes(area));
    coverage[area] = hasOpenMentor ? "open" : hasAnyMentor ? "full" : "none";
  });
  return coverage;
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
