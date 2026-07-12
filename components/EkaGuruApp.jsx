"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Sprout, Users, GraduationCap, ArrowRight, Check, X, Phone, MapPin, Languages, BadgeCheck, Loader2, Lock, Heart, MessageCircle, BookOpen, ExternalLink } from "lucide-react";
import { saveStudentProfile, saveStudentPrivateInfo, saveMentorProfile, saveMentorPrivateInfo, subscribeToCollection, completeMentorship, logAuditEvent } from "@/lib/data";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { CAREER_AREAS } from "@/lib/constants";

const STATES = ["Telangana", "Andhra Pradesh"];

const DISTRICTS_BY_STATE = {
  Telangana: [
    "Adilabad", "Bhadradri Kothagudem", "Hanumakonda", "Hyderabad", "Jagtial",
    "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy",
    "Karimnagar", "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad",
    "Mahabubnagar", "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu",
    "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad",
    "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet",
    "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"
  ],
  "Andhra Pradesh": [
    "Alluri Sitharama Raju", "Anakapalli", "Anantapur", "Annamayya", "Bapatla",
    "Chittoor", "Dr. B.R. Ambedkar Konaseema", "East Godavari", "Eluru",
    "Guntur", "Kakinada", "Krishna", "Kurnool", "Nandyal", "NTR", "Palnadu",
    "Parvathipuram Manyam", "Prakasam", "Srikakulam", "Sri Sathya Sai",
    "Sri Potti Sriramulu Nellore", "Tirupati", "Visakhapatnam", "Vizianagaram",
    "West Godavari", "YSR Kadapa"
  ]
};

const LANGUAGES = ["Telugu", "English", "Hindi", "Urdu"];

const EDU_LEVELS = ["Below Class 10", "Class 10", "Intermediate (11/12)", "Undergraduate", "Graduate"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Builds a WhatsApp "click to chat" link (wa.me) with a pre-filled message — this
// works with just a phone number, no Business API or approved template needed,
// since it's the person themself opening a normal WhatsApp conversation, not EkaGuru
// sending an automated message on their behalf.
function whatsappChatLink(phone, message) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Assumes a 10-digit Indian mobile number if no country code was entered at
  // registration; prepends 91. Adjust here if EkaGuru expands beyond India.
  const fullNumber = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
}

function computeMatches(students, mentors) {
  const mentorState = mentors.map(m => ({ ...m, load: 0 }));
  const matched = {};
  const sortedStudents = [...students].sort((a, b) => a.createdAt - b.createdAt);

  for (const s of sortedStudents) {
    let candidates = mentorState.filter(
      m => m.approved && m.load < m.maxMentees &&
      m.expertise.includes(s.careerInterest) &&
      m.languages.includes(s.language)
    );
    if (candidates.length === 0) {
      candidates = mentorState.filter(
        m => m.approved && m.load < m.maxMentees && m.expertise.includes(s.careerInterest)
      );
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.load - b.load);
      const chosen = candidates[0];
      matched[s.id] = chosen.id;
      const idx = mentorState.findIndex(m => m.id === chosen.id);
      mentorState[idx].load += 1;
    }
  }
  const loadById = {};
  mentorState.forEach(m => { loadById[m.id] = m.load; });
  return { matched, loadById };
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
        active
          ? "bg-[#0F6B5C] border-[#0F6B5C] text-white"
          : "bg-white border-[#D8CFBE] text-[#4A4235] hover:border-[#0F6B5C]"
      }`}
    >
      {children}
    </button>
  );
}

function SproutBar({ load, max }) {
  const slots = Array.from({ length: max });
  return (
    <div className="flex items-center gap-1">
      {slots.map((_, i) => (
        <Sprout
          key={i}
          size={16}
          className={i < load ? "text-[#0F6B5C]" : "text-[#E4DCC9]"}
          strokeWidth={2.5}
          fill={i < load ? "#0F6B5C" : "none"}
        />
      ))}
      <span className="text-xs text-[#8A806C] ml-1">{load}/{max}</span>
    </div>
  );
}

function EkaGuruApp() {
  const [tab, setTab] = useState("mymatch");
  const [students, setStudents] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [toast, setToast] = useState(null);

  const [sForm, setSForm] = useState({
    name: "", phone: "", state: "", district: "", edu: "", careerInterest: "", language: "",
    dateOfBirth: "", gender: "",
    parentName: "", parentPhone: "", parentRelation: "", consentGiven: false,
    schoolName: "", schoolVillage: "", schoolContactName: "", schoolContactPhone: "", schoolContactRole: ""
  });
  const [mForm, setMForm] = useState({ name: "", phone: "", profession: "", linkedinUrl: "", expertise: [], languages: [], maxMentees: 2 });
  const [schoolsCatalog, setSchoolsCatalog] = useState([]);
  const [resources, setResources] = useState([]);
  const [resourceFilter, setResourceFilter] = useState("");
  const [confirmingCompleteId, setConfirmingCompleteId] = useState(null); // studentId mid-confirmation, or null
  const [completingId, setCompletingId] = useState(null); // studentId currently being submitted
  const [studentPrivateById, setStudentPrivateById] = useState({});
  const [mentorPrivateById, setMentorPrivateById] = useState({});

  // Firestore's onSnapshot pushes live updates automatically — there's no manual
  // "loadData" step anymore, and no separate persist step either. Each collection
  // subscription keeps `students` / `mentors` in sync the moment any user (including
  // this browser tab, or the matching Cloud Function) writes a change.
  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    const TIMEOUT_MS = 8000;
    let gotFirstSnapshot = false;

    const timeoutId = setTimeout(() => {
      if (!gotFirstSnapshot) {
        setLoadError(true);
        setLoading(false); // previously missing — spinner used to hang forever even after timeout fired
      }
    }, TIMEOUT_MS);

    const unsubStudents = subscribeToCollection(
      "students",
      (docs) => {
        setStudents(docs);
        gotFirstSnapshot = true;
        setLoading(false);
        clearTimeout(timeoutId);
      },
      (error) => {
        // Most common cause: nobody is signed in yet, so Firestore's security rules
        // (which require isSignedIn() to read students) deny the request. Surface
        // this as the same error screen rather than hanging on the spinner forever.
        console.error("[EkaGuru] Failed to load students:", error);
        setLoadError(true);
        setLoading(false);
        clearTimeout(timeoutId);
      }
    );
    const unsubMentors = subscribeToCollection("mentors", (docs) => setMentors(docs), (error) =>
      console.error("[EkaGuru] Failed to load mentors:", error)
    );
    const unsubSchools = subscribeToCollection("schools", (docs) => setSchoolsCatalog(docs), (error) =>
      console.error("[EkaGuru] Failed to load schools catalog:", error)
    );
    const unsubResources = subscribeToCollection("resources", (docs) => setResources(docs), (error) =>
      console.error("[EkaGuru] Failed to load resources:", error)
    );
    // student_private is restricted by firestore.rules to the student themself or an
    // admin. A non-admin signed-in user will get a permission-denied error trying to
    // list ALL documents in this collection (Firestore denies an unfiltered query
    // unless the rule can prove every possible result is allowed) — that's expected,
    // not a bug. Only an account with the admin custom claim will see real data here.
    const unsubStudentPrivate = subscribeToCollection(
      "student_private",
      (docs) => setStudentPrivateById(Object.fromEntries(docs.map((d) => [d.id, d]))),
      (error) => console.warn("[EkaGuru] student_private unavailable (expected unless signed in as admin):", error.code)
    );
    const unsubMentorPrivate = subscribeToCollection(
      "mentor_private",
      (docs) => setMentorPrivateById(Object.fromEntries(docs.map((d) => [d.id, d]))),
      (error) => console.warn("[EkaGuru] mentor_private unavailable (expected unless signed in as admin):", error.code)
    );

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubStudents();
      unsubMentors();
      unsubSchools();
      unsubResources();
      unsubStudentPrivate();
      unsubMentorPrivate();
      clearTimeout(timeoutId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Retry button for the error screen — re-runs the same subscription setup by
  // remounting is unnecessary with onSnapshot; simplest is to just reload the page,
  // since a fresh subscription will immediately re-fetch current state.
  const loadData = () => window.location.reload();

  const activeStudentsForMatching = useMemo(
    () => students.filter(s => s.mentorshipStatus !== "completed"),
    [students]
  );
  const { matched, loadById } = useMemo(() => computeMatches(activeStudentsForMatching, mentors), [activeStudentsForMatching, mentors]);

  // Derived "my match" data — reuses the already-computed matched map rather than a
  // separate Firestore query, since students/mentors are already subscribed above.
  const myUid = auth?.currentUser?.uid;
  const myStudentRecord = useMemo(() => students.find(s => s.id === myUid), [students, myUid]);
  const myMentorRecord = useMemo(() => mentors.find(m => m.id === myUid), [mentors, myUid]);
  const myMatchedMentor = useMemo(() => {
    if (!myStudentRecord) return null;
    const mentorId = matched[myStudentRecord.id];
    return mentorId ? mentors.find(m => m.id === mentorId) : null;
  }, [myStudentRecord, matched, mentors]);
  const myMatchedStudents = useMemo(() => {
    if (!myMentorRecord) return [];
    return students.filter(s => matched[s.id] === myMentorRecord.id);
  }, [myMentorRecord, matched, students]);

  const interestAvailability = useMemo(() => {
    const availability = {};
    CAREER_AREAS.forEach(area => {
      const hasOpenMentor = mentors.some(
        m => m.approved && m.expertise.includes(area) && (loadById[m.id] || 0) < m.maxMentees
      );
      const hasAnyMentor = mentors.some(m => m.approved && m.expertise.includes(area));
      availability[area] = hasOpenMentor ? "open" : hasAnyMentor ? "full" : "none";
    });
    return availability;
  }, [mentors, loadById]);

  const matchingSchools = useMemo(() => {
    if (!sForm.state || !sForm.district) return [];
    return schoolsCatalog.filter(sc => sc.state === sForm.state && sc.district === sForm.district);
  }, [schoolsCatalog, sForm.state, sForm.district]);

  // Unique villages/towns for the selected state+district — powers the village datalist.
  const villageOptions = useMemo(() => {
    const set = new Set(matchingSchools.map(sc => sc.village).filter(Boolean));
    return [...set].sort();
  }, [matchingSchools]);

  // School name suggestions narrow further once a village/town is typed, so a common
  // school name (there are many "Zilla Parishad High School"s) doesn't show every
  // instance across the whole district — just ones near the entered village.
  const schoolNameOptions = useMemo(() => {
    if (!sForm.schoolVillage) return matchingSchools;
    const villageLower = sForm.schoolVillage.trim().toLowerCase();
    return matchingSchools.filter(sc => sc.village?.toLowerCase().includes(villageLower));
  }, [matchingSchools, sForm.schoolVillage]);

  const showToast = (msg, tone = "good") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3200);
  };

  const submitStudent = async () => {
    if (!isOnline) {
      showToast("You're offline — please reconnect before registering.", "bad");
      return;
    }
    if (!auth?.currentUser) {
      showToast("Please verify your phone number before registering.", "bad");
      return;
    }
    if (!sForm.name || !sForm.phone || !sForm.state || !sForm.district || !sForm.edu || !sForm.careerInterest || !sForm.language) {
      showToast("Please fill every field before joining.", "bad");
      return;
    }
    if (!sForm.parentName || !sForm.parentPhone || !sForm.parentRelation) {
      showToast("Parent or guardian details are required to register.", "bad");
      return;
    }
    if (!sForm.consentGiven) {
      showToast("A parent or guardian must give consent before joining.", "bad");
      return;
    }
    if (!sForm.schoolName || !sForm.schoolVillage || !sForm.schoolContactName || !sForm.schoolContactPhone || !sForm.schoolContactRole) {
      showToast("School details and a teacher or principal contact are required to register.", "bad");
      return;
    }

    const uid = auth.currentUser.uid;

    // Public profile — readable by any signed-in user (a matched mentor needs this).
    // Deliberately excludes date of birth and gender — a mentor needs career interest,
    // language, and education level, not a student's exact age or gender.
    const publicProfile = {
      name: sForm.name, phone: sForm.phone, state: sForm.state, district: sForm.district,
      edu: sForm.edu, careerInterest: sForm.careerInterest, language: sForm.language,
      consentGiven: sForm.consentGiven,
    };
    // Private data — parent + school/teacher contact, date of birth, gender. Only
    // this student or an admin can read this document; see firestore.rules.
    const privateInfo = {
      dateOfBirth: sForm.dateOfBirth, gender: sForm.gender,
      parentName: sForm.parentName, parentPhone: sForm.parentPhone, parentRelation: sForm.parentRelation,
      consentGivenAt: Date.now(),
      schoolName: sForm.schoolName, schoolVillage: sForm.schoolVillage,
      schoolContactName: sForm.schoolContactName, schoolContactPhone: sForm.schoolContactPhone,
      schoolContactRole: sForm.schoolContactRole,
    };

    try {
      await saveStudentProfile(uid, publicProfile);
      await saveStudentPrivateInfo(uid, privateInfo);
    } catch (e) {
      console.error("Registration error", e);
      showToast("Couldn't save your registration — check your connection and try again. Nothing was lost.", "bad");
      return;
    }

    // Fire-and-forget: audit logging must never block or fail registration itself.
    logAuditEvent("student_registered", { careerInterest: sForm.careerInterest, district: sForm.district })
      .catch((e) => console.error("[EkaGuru] audit log failed (non-blocking):", e));

    setSForm({
      name: "", phone: "", state: "", district: "", edu: "", careerInterest: "", language: "",
      dateOfBirth: "", gender: "",
      parentName: "", parentPhone: "", parentRelation: "", consentGiven: false,
      schoolName: "", schoolVillage: "", schoolContactName: "", schoolContactPhone: "", schoolContactRole: ""
    });

    // The Cloud Function's onStudentWrite trigger runs matching automatically on the
    // write above — the client doesn't need to compute or announce the match itself,
    // the students/matches subscription will reflect it within a second or two.
    showToast("Registered! We'll match you with a mentor and notify you as soon as possible.", "good");
  };

  const toggleExpertise = (area) => {
    setMForm(f => ({
      ...f,
      expertise: f.expertise.includes(area) ? f.expertise.filter(a => a !== area) : [...f.expertise, area]
    }));
  };
  const toggleLanguage = (lang) => {
    setMForm(f => ({
      ...f,
      languages: f.languages.includes(lang) ? f.languages.filter(l => l !== lang) : [...f.languages, lang]
    }));
  };


  const handleCompleteMentorship = async (studentId) => {
    setCompletingId(studentId);
    try {
      await completeMentorship(studentId);
      showToast("Mentorship marked as complete. Capacity is now freed up for a new match.", "good");
    } catch (e) {
      console.error("[EkaGuru] completeMentorship failed:", e);
      showToast("Couldn't complete this mentorship — check your connection and try again.", "bad");
    }
    setCompletingId(null);
    setConfirmingCompleteId(null);
  };

  const submitMentor = async () => {
    if (!isOnline) {
      showToast("You're offline — please reconnect before registering.", "bad");
      return;
    }
    if (!auth?.currentUser) {
      showToast("Please verify your phone number before registering.", "bad");
      return;
    }
    if (!mForm.name || !mForm.phone || !mForm.profession || mForm.expertise.length === 0 || mForm.languages.length === 0) {
      showToast("Please fill every field and pick at least one area and language.", "bad");
      return;
    }
    if (!mForm.linkedinUrl || !mForm.linkedinUrl.toLowerCase().includes("linkedin.com")) {
      showToast("Please share a valid LinkedIn profile URL — this helps admins verify volunteers.", "bad");
      return;
    }

    try {
      // saveMentorProfile always writes approved: false — firestore.rules blocks a
      // mentor from setting their own approval. An admin approves via the
      // setMentorApproval Cloud Function (see the Firebase backend README).
      // This differs from the earlier client-only demo, which auto-approved
      // client-side for the sake of a self-contained walkthrough.
      const { linkedinUrl, ...publicMentorFields } = mForm;
      await saveMentorProfile(auth.currentUser.uid, publicMentorFields);
      await saveMentorPrivateInfo(auth.currentUser.uid, { linkedinUrl });
    } catch (e) {
      console.error("Registration error", e);
      showToast("Couldn't save your registration — check your connection and try again. Nothing was lost.", "bad");
      return;
    }

    logAuditEvent("mentor_registered", { expertise: mForm.expertise })
      .catch((e) => console.error("[EkaGuru] audit log failed (non-blocking):", e));

    setMForm({ name: "", phone: "", profession: "", linkedinUrl: "", expertise: [], languages: [], maxMentees: 2 });
    showToast("Thank you for volunteering — your application is under review.", "good");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF]">
        <Loader2 className="animate-spin text-[#0F6B5C]" size={28} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF] px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-[#C1502E]/10 flex items-center justify-center mx-auto mb-4">
            <X size={24} className="text-[#C1502E]" />
          </div>
          <h2 className="display text-xl font-bold text-[#1B2A4A] mb-2">Couldn't connect</h2>
          <p className="text-sm text-[#8A806C] mb-5">
            EkaGuru is taking too long to respond. This could be your connection or something on our end
            — either way, nothing has been lost. Please try again.
          </p>
          <button onClick={loadData}
            className="bg-[#0F6B5C] hover:bg-[#0C5A4D] text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const unmatchedStudents = students.filter(s => !matched[s.id]);
  const matchedPairs = students.filter(s => matched[s.id]).map(s => ({
    student: s,
    mentor: mentors.find(m => m.id === matched[s.id])
  }));

  const unmetDemand = unmatchedStudents.reduce((acc, s) => {
    acc[s.careerInterest] = (acc[s.careerInterest] || 0) + 1;
    return acc;
  }, {});
  const unmetDemandSorted = Object.entries(unmetDemand).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen ikkat-bg text-[#2A2620]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .display { font-family: 'Zilla Slab', serif; }
        .ikkat-bg {
          background-color: #FAF6EF;
          background-image:
            repeating-linear-gradient(45deg, rgba(232,163,61,0.10) 0px, rgba(232,163,61,0.10) 2px, transparent 2px, transparent 18px),
            repeating-linear-gradient(-45deg, rgba(15,107,92,0.08) 0px, rgba(15,107,92,0.08) 2px, transparent 2px, transparent 18px),
            radial-gradient(circle at 15% 20%, rgba(27,42,74,0.06) 0, rgba(27,42,74,0.06) 8px, transparent 9px),
            radial-gradient(circle at 65% 60%, rgba(193,80,46,0.06) 0, rgba(193,80,46,0.06) 8px, transparent 9px),
            radial-gradient(circle at 85% 15%, rgba(15,107,92,0.06) 0, rgba(15,107,92,0.06) 8px, transparent 9px);
          background-size: 36px 36px, 36px 36px, 140px 140px, 160px 160px, 120px 120px;
        }
        .ikkat-border {
          background-image: repeating-linear-gradient(90deg, #E8A33D 0px, #E8A33D 10px, #0F6B5C 10px, #0F6B5C 20px, #C1502E 20px, #C1502E 30px);
          height: 4px;
        }
      `}</style>

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.tone === "good" ? "bg-[#0F6B5C] text-white" : "bg-[#C1502E] text-white"
        }`}>
          {toast.tone === "good" ? <Check size={16} /> : <X size={16} />}
          {toast.msg}
        </div>
      )}

      {!isOnline && (
        <div className="bg-[#C1502E] text-white text-sm font-medium text-center py-2 px-4">
          You're offline. Registrations and updates won't save until you're back online.
        </div>
      )}

      {/* Hero */}
      <header className="border-b border-[#E4DCC9] px-6 py-10 md:py-14 bg-white/40 relative">
        <div className="ikkat-border w-full absolute top-0 left-0" />
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[#0F6B5C] text-sm font-semibold tracking-wide uppercase">
              <Sprout size={16} /> EkaGuru · ఏకగురు
            </div>
            <button
              onClick={() => signOut(auth)}
              className="text-xs text-[#8A806C] hover:text-[#1B2A4A] underline underline-offset-2"
            >
              Sign out
            </button>
          </div>
          <h1 className="display text-4xl md:text-5xl font-bold text-[#1B2A4A] leading-tight max-w-2xl">
            A path to a career, guided by someone who's already walked it.
          </h1>
          <p className="text-[#5B5343] mt-4 max-w-xl">
            Inspired by Ekalavya, who mastered his craft without a guru by his side —
            EkaGuru connects students across Telangana and Andhra Pradesh with volunteer mentors,
            matched automatically by career interest, language, and district.
          </p>
          <div className="flex gap-6 mt-8 text-sm">
            <div><span className="display text-2xl font-bold text-[#1B2A4A]">{students.length}</span> <span className="text-[#8A806C]">students</span></div>
            <div><span className="display text-2xl font-bold text-[#1B2A4A]">{mentors.filter(m=>m.approved).length}</span> <span className="text-[#8A806C]">mentors</span></div>
            <div><span className="display text-2xl font-bold text-[#1B2A4A]">{matchedPairs.length}</span> <span className="text-[#8A806C]">matched</span></div>
            {unmatchedStudents.length > 0 && (
              <div><span className="display text-2xl font-bold text-[#C1502E]">{unmatchedStudents.length}</span> <span className="text-[#8A806C]">waiting</span></div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="max-w-5xl mx-auto px-6 pt-6 flex gap-2">
        {[
          { id: "mymatch", label: "My Match", icon: Heart },
          { id: "resources", label: "Resources", icon: BookOpen },
          { id: "student", label: "Join as a student", icon: GraduationCap },
          { id: "mentor", label: "Volunteer as a mentor", icon: Users },
          { id: "dashboard", label: "Dashboard", icon: BadgeCheck },
          { id: "admin", label: "Admin", icon: Lock },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-[#0F6B5C] text-[#1B2A4A]" : "border-transparent text-[#8A806C] hover:text-[#1B2A4A]"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-6 pb-16 pt-6">
        {tab === "mymatch" && (
          <div className="max-w-xl">
            {myStudentRecord?.mentorshipStatus === "completed" ? (
              <div className="bg-white rounded-2xl border border-[#E4DCC9] p-6 md:p-8 text-center">
                <Check size={28} className="text-[#0F6B5C] mx-auto mb-3" />
                <h2 className="display text-xl font-bold text-[#1B2A4A] mb-2">Mentorship completed</h2>
                <p className="text-sm text-[#8A806C]">
                  This chapter is done — thank you for being part of EkaGuru. If you'd like guidance
                  in a new area, reach out to an admin about registering again.
                </p>
              </div>
            ) : myStudentRecord ? (
              myMatchedMentor ? (
                <div className="bg-white rounded-2xl border border-[#E4DCC9] p-6 md:p-8">
                  <div className="text-xs font-semibold text-[#0F6B5C] uppercase tracking-wide mb-1">Your mentor</div>
                  <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-1">{myMatchedMentor.name}</h2>
                  <p className="text-sm text-[#8A806C] mb-4">{myMatchedMentor.profession}</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {myMatchedMentor.expertise.map(a => (
                      <span key={a} className="text-xs bg-[#0F6B5C]/10 text-[#0F6B5C] px-2.5 py-1 rounded-full">{a}</span>
                    ))}
                  </div>
                  <a
                    href={whatsappChatLink(
                      myMatchedMentor.phone,
                      `Hi ${myMatchedMentor.name}, I'm ${myStudentRecord.name} from EkaGuru! I'm interested in ${myStudentRecord.careerInterest} and would love your guidance.`
                    )}
                    target="_blank" rel="noopener noreferrer"
                    className="w-full bg-[#0F6B5C] hover:bg-[#0C5A4D] text-white font-semibold rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle size={16} /> Message on WhatsApp
                  </a>
                  <p className="text-xs text-[#8A806C] mt-3 text-center mb-4">
                    Opens WhatsApp with a friendly intro message already written — you can edit it before sending.
                  </p>

                  {resources.filter(r => r.careerInterest === myStudentRecord.careerInterest).length > 0 && (
                    <div className="border-t border-[#E4DCC9] pt-4 mb-4">
                      <div className="text-xs font-semibold text-[#8A806C] uppercase tracking-wide mb-2">
                        Recommended resources for {myStudentRecord.careerInterest}
                      </div>
                      <div className="space-y-2">
                        {resources.filter(r => r.careerInterest === myStudentRecord.careerInterest).slice(0, 3).map(r => (
                          <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-[#0F6B5C] hover:text-[#0C5A4D] font-medium">
                            <BookOpen size={14} /> {r.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-[#E4DCC9] pt-4">
                    {confirmingCompleteId === myStudentRecord.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCompleteMentorship(myStudentRecord.id)}
                          disabled={completingId === myStudentRecord.id}
                          className="flex-1 text-sm font-semibold text-white bg-[#C1502E] hover:bg-[#A8431F] disabled:opacity-60 rounded-lg py-2"
                        >
                          {completingId === myStudentRecord.id ? "Completing..." : "Yes, mark as complete"}
                        </button>
                        <button
                          onClick={() => setConfirmingCompleteId(null)}
                          className="flex-1 text-sm font-medium text-[#8A806C] hover:text-[#1B2A4A] rounded-lg py-2"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingCompleteId(myStudentRecord.id)}
                        className="text-xs text-[#8A806C] hover:text-[#1B2A4A] underline underline-offset-2"
                      >
                        Mark this mentorship as complete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-dashed border-[#D8CFBE] p-6 md:p-8 text-center">
                  <h2 className="display text-xl font-bold text-[#1B2A4A] mb-2">You're on the waitlist</h2>
                  <p className="text-sm text-[#8A806C]">
                    No mentor is available in <strong>{myStudentRecord.careerInterest}</strong> yet.
                    We'll notify you on WhatsApp the moment one joins — no need to do anything else.
                  </p>
                </div>
              )
            ) : myMentorRecord ? (
              !myMentorRecord.approved ? (
                <div className="bg-white rounded-2xl border border-dashed border-[#D8CFBE] p-6 md:p-8 text-center">
                  <h2 className="display text-xl font-bold text-[#1B2A4A] mb-2">Application under review</h2>
                  <p className="text-sm text-[#8A806C]">
                    Thank you for volunteering — an EkaGuru admin will review your application soon.
                  </p>
                </div>
              ) : myMatchedStudents.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-[#D8CFBE] p-6 md:p-8 text-center">
                  <h2 className="display text-xl font-bold text-[#1B2A4A] mb-2">No students matched yet</h2>
                  <p className="text-sm text-[#8A806C]">
                    You're approved and visible to students — we'll notify you as soon as someone is matched to you.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="display text-xl font-bold text-[#1B2A4A]">Your students</h2>
                    <SproutBar load={loadById[myMentorRecord.id] || 0} max={myMentorRecord.maxMentees} />
                  </div>
                  {myMatchedStudents.map(s => (
                    <div key={s.id} className="bg-white rounded-2xl border border-[#E4DCC9] p-5">
                      <div className="font-semibold text-[#1B2A4A]">{s.name}</div>
                      <div className="text-xs text-[#8A806C] mb-3">{s.district}, {s.state} · {s.careerInterest} · {s.edu}</div>
                      <a
                        href={whatsappChatLink(
                          s.phone,
                          `Hi ${s.name}, I'm ${myMentorRecord.name} from EkaGuru — happy to help with ${s.careerInterest}. When's a good time to talk?`
                        )}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F6B5C] hover:text-[#0C5A4D] mb-3"
                      >
                        <MessageCircle size={14} /> Message on WhatsApp
                      </a>
                      <div className="border-t border-[#E4DCC9] pt-3">
                        {confirmingCompleteId === s.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCompleteMentorship(s.id)}
                              disabled={completingId === s.id}
                              className="text-xs font-semibold text-white bg-[#C1502E] hover:bg-[#A8431F] disabled:opacity-60 rounded-lg px-3 py-1.5"
                            >
                              {completingId === s.id ? "Completing..." : "Yes, mark complete"}
                            </button>
                            <button
                              onClick={() => setConfirmingCompleteId(null)}
                              className="text-xs font-medium text-[#8A806C] hover:text-[#1B2A4A] px-3 py-1.5"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingCompleteId(s.id)}
                            className="text-xs text-[#8A806C] hover:text-[#1B2A4A] underline underline-offset-2"
                          >
                            Mark this mentorship as complete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-[#D8CFBE] p-6 md:p-8 text-center">
                <h2 className="display text-xl font-bold text-[#1B2A4A] mb-2">You haven't registered yet</h2>
                <p className="text-sm text-[#8A806C]">
                  Use the <strong>Join as a student</strong> or <strong>Volunteer as a mentor</strong> tab above to get started.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "resources" && (
          <div>
            <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-1">Free learning resources</h2>
            <p className="text-sm text-[#8A806C] mb-5">
              Curated links to free or low-cost courses and official exam resources — not a substitute
              for your mentor, but useful for self-study between sessions.
            </p>

            <select value={resourceFilter} onChange={e => setResourceFilter(e.target.value)}
              className="border border-[#D8CFBE] rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]">
              <option value="">All career interests</option>
              {CAREER_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            {resources.length === 0 ? (
              <p className="text-sm text-[#8A806C]">No resources loaded yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {resources
                  .filter(r => !resourceFilter || r.careerInterest === resourceFilter)
                  .map(r => (
                    <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="bg-white border border-[#E4DCC9] rounded-xl p-4 hover:border-[#0F6B5C] transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#0F6B5C] uppercase tracking-wide">{r.careerInterest}</span>
                        {r.isFree && <span className="text-xs bg-[#0F6B5C]/10 text-[#0F6B5C] px-2 py-0.5 rounded-full">Free</span>}
                      </div>
                      <div className="font-semibold text-[#1B2A4A] flex items-center gap-1.5">
                        {r.title} <ExternalLink size={12} className="text-[#8A806C]" />
                      </div>
                      <div className="text-xs text-[#8A806C] mt-1">{r.provider}</div>
                      {r.description && <p className="text-xs text-[#4A4235] mt-2">{r.description}</p>}
                    </a>
                  ))}
              </div>
            )}
          </div>
        )}

        {tab === "student" && (
          <div className="bg-white rounded-2xl border border-[#E4DCC9] p-6 md:p-8 max-w-xl">
            <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-1">Tell us about yourself</h2>
            <p className="text-sm text-[#8A806C] mb-6">We'll match you with a mentor automatically once you submit.</p>

            <div className="space-y-4">
              <input placeholder="Full name" value={sForm.name} onChange={e => setSForm({ ...sForm, name: e.target.value })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
              <input placeholder="Phone number" value={sForm.phone} onChange={e => setSForm({ ...sForm, phone: e.target.value })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />

              <select value={sForm.state} onChange={e => setSForm({ ...sForm, state: e.target.value, district: "" })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]">
                <option value="">State</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select value={sForm.district} onChange={e => setSForm({ ...sForm, district: e.target.value })}
                disabled={!sForm.state}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C] disabled:bg-[#F4F1EA] disabled:text-[#B0A890]">
                <option value="">{sForm.state ? "District" : "Select a state first"}</option>
                {(DISTRICTS_BY_STATE[sForm.state] || []).map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select value={sForm.edu} onChange={e => setSForm({ ...sForm, edu: e.target.value })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]">
                <option value="">Current education level</option>
                {EDU_LEVELS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select value={sForm.careerInterest} onChange={e => setSForm({ ...sForm, careerInterest: e.target.value })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]">
                <option value="">Career interest</option>
                {CAREER_AREAS.map(d => (
                  <option key={d} value={d}>
                    {d} {interestAvailability[d] === "open" ? "· mentors available" : "· no mentor available yet"}
                  </option>
                ))}
              </select>

              {sForm.careerInterest && interestAvailability[sForm.careerInterest] !== "open" && (
                <div className="flex items-start gap-2 bg-[#C1502E]/10 border border-[#C1502E]/30 rounded-lg px-3 py-2.5 text-xs text-[#8A3A22]">
                  <span>⏳</span>
                  <span>
                    No mentor is available in <strong>{sForm.careerInterest}</strong> right now. You can still register —
                    you'll be added to the waitlist and matched automatically the moment a mentor joins. We'll notify you on WhatsApp.
                  </span>
                </div>
              )}

              <select value={sForm.language} onChange={e => setSForm({ ...sForm, language: e.target.value })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]">
                <option value="">Preferred language</option>
                {LANGUAGES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <div>
                <label className="text-xs text-[#8A806C] mb-1 block">Date of birth (optional)</label>
                <input type="date" value={sForm.dateOfBirth} max={new Date().toISOString().split("T")[0]}
                  onChange={e => setSForm({ ...sForm, dateOfBirth: e.target.value })}
                  className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
              </div>

              <select value={sForm.gender} onChange={e => setSForm({ ...sForm, gender: e.target.value })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]">
                <option value="">Gender (optional)</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
              <p className="text-xs text-[#8A806C] -mt-2">
                Kept private — used only for EkaGuru's internal records, never shown to your mentor.
              </p>

              <div className="pt-2 border-t border-[#E4DCC9]">
                <div className="text-sm font-semibold text-[#1B2A4A] mt-4 mb-1">Parent or guardian details</div>
                <p className="text-xs text-[#8A806C] mb-3">Required for every student. A parent or guardian must confirm they know about and approve this registration.</p>

                <div className="space-y-3">
                  <input placeholder="Parent or guardian's full name" value={sForm.parentName}
                    onChange={e => setSForm({ ...sForm, parentName: e.target.value })}
                    className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
                  <input placeholder="Parent or guardian's phone number" value={sForm.parentPhone}
                    onChange={e => setSForm({ ...sForm, parentPhone: e.target.value })}
                    className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
                  <select value={sForm.parentRelation} onChange={e => setSForm({ ...sForm, parentRelation: e.target.value })}
                    className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]">
                    <option value="">Relationship to student</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Guardian">Guardian</option>
                  </select>
                </div>

                <label className="flex items-start gap-3 mt-4 cursor-pointer">
                  <input type="checkbox" checked={sForm.consentGiven}
                    onChange={e => setSForm({ ...sForm, consentGiven: e.target.checked })}
                    className="mt-1 w-4 h-4 accent-[#0F6B5C]" />
                  <span className="text-xs text-[#4A4235] leading-relaxed">
                    I confirm I am the parent or guardian named above, and I give permission for this
                    student to be registered on EkaGuru and matched with a volunteer mentor for career
                    guidance. I understand the student's name, contact details, and career interests
                    will be shared with their matched mentor.
                  </span>
                </label>
              </div>

              <div className="pt-2 border-t border-[#E4DCC9]">
                <div className="text-sm font-semibold text-[#1B2A4A] mt-4 mb-1">Current school</div>
                <p className="text-xs text-[#8A806C] mb-3">
                  Used to verify enrollment. <strong>Visible only to EkaGuru admins</strong> — never shown
                  to the matched mentor.
                </p>

                <div className="space-y-3">
                  <div>
                    <input placeholder="School village or town" value={sForm.schoolVillage}
                      onChange={e => setSForm({ ...sForm, schoolVillage: e.target.value })}
                      list="school-village-options"
                      className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
                    <datalist id="school-village-options">
                      {villageOptions.map(v => <option key={v} value={v} />)}
                    </datalist>
                  </div>

                  <div>
                    <input placeholder="School name" value={sForm.schoolName}
                      onChange={e => setSForm({ ...sForm, schoolName: e.target.value })}
                      list="school-name-options"
                      className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
                    <datalist id="school-name-options">
                      {schoolNameOptions.map(sc => <option key={sc.id} value={sc.name} />)}
                    </datalist>
                    {sForm.state && sForm.district ? (
                      matchingSchools.length > 0 ? (
                        <p className="text-xs text-[#8A806C] mt-1">
                          {schoolNameOptions.length} school{schoolNameOptions.length === 1 ? "" : "s"} suggested for {sForm.district}
                          {sForm.schoolVillage ? `, near "${sForm.schoolVillage}"` : ""}. Can't find yours? Just type it in.
                        </p>
                      ) : (
                        <p className="text-xs text-[#8A806C] mt-1">
                          No schools loaded yet for {sForm.district} — type your school's name manually.
                        </p>
                      )
                    ) : (
                      <p className="text-xs text-[#8A806C] mt-1">
                        Select your state and district above to see school suggestions.
                      </p>
                    )}
                  </div>

                  <input placeholder="Teacher or principal's name" value={sForm.schoolContactName}
                    onChange={e => setSForm({ ...sForm, schoolContactName: e.target.value })}
                    className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
                  <input placeholder="Teacher or principal's phone number" value={sForm.schoolContactPhone}
                    onChange={e => setSForm({ ...sForm, schoolContactPhone: e.target.value })}
                    className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
                  <select value={sForm.schoolContactRole} onChange={e => setSForm({ ...sForm, schoolContactRole: e.target.value })}
                    className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]">
                    <option value="">Their role</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Principal">Principal</option>
                    <option value="Headmaster">Headmaster</option>
                  </select>
                </div>
              </div>

              <button onClick={submitStudent}
                className="w-full bg-[#E8A33D] hover:bg-[#D6922E] text-[#1B2A4A] font-semibold rounded-lg py-3 flex items-center justify-center gap-2 transition-colors">
                Find my mentor <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {tab === "mentor" && (
          <div className="bg-white rounded-2xl border border-[#E4DCC9] p-6 md:p-8 max-w-xl">
            <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-1">Volunteer your time</h2>
            <p className="text-sm text-[#8A806C] mb-6">Set your expertise and availability — we'll route the right students to you.</p>

            <div className="space-y-4">
              <input placeholder="Full name" value={mForm.name} onChange={e => setMForm({ ...mForm, name: e.target.value })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
              <input placeholder="Phone number" value={mForm.phone} onChange={e => setMForm({ ...mForm, phone: e.target.value })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
              <input placeholder="Profession (e.g. Software Engineer at TCS)" value={mForm.profession} onChange={e => setMForm({ ...mForm, profession: e.target.value })}
                className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
              <div>
                <input placeholder="LinkedIn profile URL" value={mForm.linkedinUrl} onChange={e => setMForm({ ...mForm, linkedinUrl: e.target.value })}
                  className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
                <p className="text-xs text-[#8A806C] mt-1">
                  Helps our admin team verify volunteers before approval — only shown to admins, never to students.
                </p>
              </div>

              <div>
                <div className="text-sm font-medium text-[#4A4235] mb-2">Areas you can mentor in</div>
                <div className="flex flex-wrap gap-2">
                  {CAREER_AREAS.map(a => (
                    <Chip key={a} active={mForm.expertise.includes(a)} onClick={() => toggleExpertise(a)}>{a}</Chip>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-[#4A4235] mb-2">Languages you're comfortable mentoring in</div>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(l => (
                    <Chip key={l} active={mForm.languages.includes(l)} onClick={() => toggleLanguage(l)}>{l}</Chip>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-[#4A4235] mb-2">How many students can you mentor at once?</div>
                <input type="number" min={1} max={10} value={mForm.maxMentees}
                  onChange={e => setMForm({ ...mForm, maxMentees: Math.max(1, Number(e.target.value)) })}
                  className="w-24 border border-[#D8CFBE] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
              </div>

              <button onClick={submitMentor}
                className="w-full bg-[#0F6B5C] hover:bg-[#0C5A4D] text-white font-semibold rounded-lg py-3 flex items-center justify-center gap-2 transition-colors">
                Register as a mentor <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="space-y-10">
            <section>
              <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-4">Matched pairs</h2>
              {matchedPairs.length === 0 ? (
                <p className="text-sm text-[#8A806C]">No matches yet — register a student and a mentor with overlapping interest and language to see one form here.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {matchedPairs.map(({ student, mentor }) => (
                    <div key={student.id} className="bg-white border border-[#E4DCC9] rounded-xl p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="font-semibold text-[#1B2A4A] flex items-center gap-1.5">
                          {student.name}
                          {student.consentGiven && (
                            <span title={`Consent given by ${student.parentRelation}: ${student.parentName}`}>
                              <BadgeCheck size={14} className="text-[#0F6B5C]" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#8A806C] flex items-center gap-1"><MapPin size={12} />{student.district}, {student.state} · {student.careerInterest}</div>
                      </div>
                      <ArrowRight size={16} className="text-[#0F6B5C] shrink-0" />
                      <div className="flex-1 text-right">
                        <div className="font-semibold text-[#1B2A4A]">{mentor?.name}</div>
                        <div className="text-xs text-[#8A806C]">{mentor?.profession}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-1">Unmet demand</h2>
              <p className="text-sm text-[#8A806C] mb-4">Career interests where students are waiting because no approved mentor has room — recruit here first.</p>
              {unmetDemandSorted.length === 0 ? (
                <p className="text-sm text-[#8A806C]">No unmet demand right now — every student has a mentor.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {unmetDemandSorted.map(([interest, count]) => (
                    <div key={interest} className="flex items-center gap-2 bg-[#C1502E]/10 border border-[#C1502E]/30 rounded-full pl-3 pr-2 py-1.5">
                      <span className="text-sm text-[#8A3A22] font-medium">{interest}</span>
                      <span className="text-xs font-bold bg-[#C1502E] text-white rounded-full w-5 h-5 flex items-center justify-center">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-4">Awaiting a mentor</h2>
              {unmatchedStudents.length === 0 ? (
                <p className="text-sm text-[#8A806C]">Everyone registered has been matched.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {unmatchedStudents.map(s => (
                    <div key={s.id} className="bg-white border border-dashed border-[#D8CFBE] rounded-xl p-4">
                      <div className="font-semibold text-[#1B2A4A]">{s.name}</div>
                      <div className="text-xs text-[#8A806C]">{s.careerInterest} · {s.language} · {s.district}, {s.state}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-4">Mentors</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {mentors.length === 0 && <p className="text-sm text-[#8A806C]">No mentors registered yet.</p>}
                {mentors.map(m => (
                  <div key={m.id} className="bg-white border border-[#E4DCC9] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-[#1B2A4A]">{m.name}</div>
                      {m.approved ? (
                        <span className="text-xs bg-[#0F6B5C]/10 text-[#0F6B5C] px-2 py-0.5 rounded-full font-medium">Approved</span>
                      ) : (
                        <span className="text-xs bg-[#C1502E]/10 text-[#C1502E] px-2 py-0.5 rounded-full font-medium">In review</span>
                      )}
                    </div>
                    <div className="text-xs text-[#8A806C] mb-2">{m.profession}</div>
                    <div className="text-xs text-[#8A806C] mb-2 flex items-center gap-1"><Languages size={12} />{m.languages.join(", ")}</div>
                    <SproutBar load={loadById[m.id] || 0} max={m.maxMentees} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "admin" && (
          <div>
            <div className="flex items-start gap-2 bg-[#1B2A4A]/5 border border-[#1B2A4A]/15 rounded-lg px-4 py-3 mb-6 text-xs text-[#4A4235]">
              <Lock size={14} className="mt-0.5 shrink-0 text-[#1B2A4A]" />
              <span>
                This tab shows parent, school, and teacher/principal contact details that are never
                displayed to mentors. This data lives in a separate
                <code className="mx-1 bg-white px-1 rounded">student_private</code> Firestore collection,
                enforced by <code className="mx-1 bg-white px-1 rounded">firestore.rules</code> — only the
                student themself or a signed-in user with the
                <code className="mx-1 bg-white px-1 rounded">admin</code> custom claim can read it.
                If the fields below are blank, you're not currently signed in as an admin — the tab
                itself isn't gated on that yet (a follow-up item), but the underlying data access is.
              </span>
            </div>

            <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-4">Student records</h2>
            {students.length === 0 ? (
              <p className="text-sm text-[#8A806C]">No students registered yet.</p>
            ) : (
              <div className="space-y-3">
                {students.map(s => {
                  const priv = studentPrivateById[s.id];
                  return (
                    <div key={s.id} className="bg-white border border-[#E4DCC9] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-[#1B2A4A]">{s.name}</div>
                        <span className="text-xs text-[#8A806C]">{s.edu} · {s.careerInterest}</span>
                      </div>
                      {priv ? (
                        <div className="grid md:grid-cols-3 gap-4 text-xs text-[#4A4235]">
                          <div>
                            <div className="font-semibold text-[#8A806C] uppercase tracking-wide mb-1">Personal</div>
                            <div>DOB: {priv.dateOfBirth || "—"}</div>
                            <div>Gender: {priv.gender || "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-[#8A806C] uppercase tracking-wide mb-1">Parent / guardian</div>
                            <div>{priv.parentName} ({priv.parentRelation})</div>
                            <div className="flex items-center gap-1"><Phone size={11} />{priv.parentPhone}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-[#8A806C] uppercase tracking-wide mb-1">School</div>
                            <div>{priv.schoolName}, {priv.schoolVillage}</div>
                            <div>{priv.schoolContactName} ({priv.schoolContactRole})</div>
                            <div className="flex items-center gap-1"><Phone size={11} />{priv.schoolContactPhone}</div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8A806C] italic">
                          Parent and school details not visible — sign in as an admin to view.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <h2 className="display text-2xl font-bold text-[#1B2A4A] mb-4 mt-10">Mentor records</h2>
            {mentors.length === 0 ? (
              <p className="text-sm text-[#8A806C]">No mentors registered yet.</p>
            ) : (
              <div className="space-y-3">
                {mentors.map(m => {
                  const priv = mentorPrivateById[m.id];
                  return (
                    <div key={m.id} className="bg-white border border-[#E4DCC9] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-[#1B2A4A]">{m.name}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.approved ? "bg-[#0F6B5C]/10 text-[#0F6B5C]" : "bg-[#C1502E]/10 text-[#C1502E]"}`}>
                          {m.approved ? "Approved" : "Pending review"}
                        </span>
                      </div>
                      <div className="text-xs text-[#8A806C] mb-2">{m.profession}</div>
                      {priv?.linkedinUrl ? (
                        <a href={priv.linkedinUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-[#0F6B5C] hover:text-[#0C5A4D] font-medium underline underline-offset-2">
                          View LinkedIn profile ↗
                        </a>
                      ) : (
                        <p className="text-xs text-[#8A806C] italic">
                          LinkedIn not visible — sign in as an admin to view.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("EkaGuru crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF] px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-full bg-[#C1502E]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-[#1B2A4A] mb-2">Something went wrong</h2>
            <p className="text-sm text-[#8A806C] mb-5">
              EkaGuru ran into a problem and couldn't continue. Your registered data is safe —
              reloading usually fixes this.
            </p>
            <button onClick={() => window.location.reload()}
              className="bg-[#0F6B5C] hover:bg-[#0C5A4D] text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <EkaGuruApp />
    </ErrorBoundary>
  );
}
