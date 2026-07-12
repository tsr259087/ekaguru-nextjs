"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Star, Check, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { submitFeedback } from "@/lib/data";
import Login from "@/components/Login";

export const dynamic = "force-dynamic";

function FeedbackForm({ studentId, role }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please choose a rating before submitting.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await submitFeedback({ studentId, role, rating, comment });
      setSubmitted(true);
    } catch (e) {
      console.error("[EkaGuru] submitFeedback failed:", e);
      setError("Couldn't submit your feedback — check your connection and try again.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="text-center">
        <Check size={32} className="text-[#0F6B5C] mx-auto mb-3" />
        <h1 className="display text-xl font-bold text-[#1B2A4A] mb-2">Thank you!</h1>
        <p className="text-sm text-[#8A806C]">
          Your feedback helps EkaGuru match students and mentors better in the future.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="display text-xl font-bold text-[#1B2A4A] mb-1">
        {role === "student" ? "How was your mentor?" : "How did the mentorship go?"}
      </h1>
      <p className="text-sm text-[#8A806C] mb-5">
        Your feedback is only visible to EkaGuru admins, not shared with the other person directly.
      </p>

      <div className="flex gap-2 justify-center mb-5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            <Star
              size={32}
              className={(hoverRating || rating) >= n ? "text-[#E8A33D]" : "text-[#D8CFBE]"}
              fill={(hoverRating || rating) >= n ? "#E8A33D" : "none"}
            />
          </button>
        ))}
      </div>

      <textarea
        placeholder="Anything else you'd like to share? (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]"
      />

      {error && <p className="text-xs text-[#C1502E] mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-[#0F6B5C] hover:bg-[#0C5A4D] disabled:opacity-60 text-white font-semibold rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : "Submit feedback"}
      </button>
    </div>
  );
}

export default function FeedbackPage() {
  const { studentId } = useParams();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") === "mentor" ? "mentor" : "student";

  const [user, setUser] = useState(undefined);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF] px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .display { font-family: 'Zilla Slab', serif; }
      `}</style>

      {user === undefined ? (
        <Loader2 className="animate-spin text-[#0F6B5C]" size={28} />
      ) : user === null ? (
        <Login onSignedIn={() => {}} />
      ) : (
        <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E4DCC9] p-6 md:p-8">
          <FeedbackForm studentId={studentId} role={role} />
        </div>
      )}
    </div>
  );
}
