"use client";

import { useState } from "react";
import { Phone, ArrowRight, Loader2, Check, X } from "lucide-react";
import { sendOtp, verifyOtp } from "@/lib/auth";

export default function Login({ onSignedIn }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone"); // "phone" | "code"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizePhone = (raw) => {
    // Accepts "9876543210" or "+919876543210" — normalizes to E.164 for India.
    // Adjust the country code prefix here if EkaGuru expands beyond India.
    const digits = raw.replace(/\D/g, "");
    if (raw.trim().startsWith("+")) return `+${digits}`;
    return `+91${digits}`;
  };

  const handleSendOtp = async () => {
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }
    setLoading(true);
    try {
      await sendOtp(normalizePhone(phone));
      setStep("code");
    } catch (e) {
      console.error("[EkaGuru] sendOtp failed:", e);
      // Firebase error codes worth surfacing specifically; everything else gets a
      // generic message rather than leaking a raw Firebase error string to the user.
      if (e.code === "auth/invalid-phone-number") {
        setError("That phone number doesn't look valid. Please check and try again.");
      } else if (e.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a while before trying again.");
      } else {
        setError("Couldn't send the code — check your connection and try again.");
      }
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (code.trim().length < 6) {
      setError("Enter the 6-digit code sent to your phone.");
      return;
    }
    setLoading(true);
    try {
      const user = await verifyOtp(code.trim());
      onSignedIn(user);
    } catch (e) {
      console.error("[EkaGuru] verifyOtp failed:", e);
      if (e.code === "auth/invalid-verification-code") {
        setError("That code is incorrect. Please check and try again.");
      } else if (e.code === "auth/code-expired") {
        setError("That code has expired. Go back and request a new one.");
      } else {
        setError("Couldn't verify the code — check your connection and try again.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF6EF] px-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        .display { font-family: 'Zilla Slab', serif; }
      `}</style>

      {/* Required by Firebase's invisible reCAPTCHA — must exist in the DOM before sendOtp is called. */}
      <div id="recaptcha-container" />

      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E4DCC9] p-6 md:p-8">
        <div className="text-[#0F6B5C] text-sm font-semibold tracking-wide uppercase mb-2">
          EkaGuru · ఏకగురు
        </div>
        <h1 className="display text-2xl font-bold text-[#1B2A4A] mb-1">
          {step === "phone" ? "Sign in to continue" : "Enter the code"}
        </h1>
        <p className="text-sm text-[#8A806C] mb-6">
          {step === "phone"
            ? "We'll text you a one-time code — no password needed."
            : `We sent a 6-digit code to ${normalizePhone(phone)}.`}
        </p>

        {error && (
          <div className="flex items-start gap-2 bg-[#C1502E]/10 border border-[#C1502E]/30 rounded-lg px-3 py-2.5 text-xs text-[#8A3A22] mb-4">
            <X size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "phone" ? (
          <div className="space-y-3">
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A806C]" />
              <input
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                className="w-full border border-[#D8CFBE] rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]"
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-[#E8A33D] hover:bg-[#D6922E] disabled:opacity-60 text-[#1B2A4A] font-semibold rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <>Send code <ArrowRight size={16} /></>}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
              maxLength={6}
              className="w-full border border-[#D8CFBE] rounded-lg px-3 py-2.5 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-[#0F6B5C] hover:bg-[#0C5A4D] disabled:opacity-60 text-white font-semibold rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <>Verify <Check size={16} /></>}
            </button>
            <button
              onClick={() => { setStep("phone"); setCode(""); setError(""); }}
              className="w-full text-xs text-[#8A806C] hover:text-[#1B2A4A] py-1"
            >
              Wrong number? Go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
