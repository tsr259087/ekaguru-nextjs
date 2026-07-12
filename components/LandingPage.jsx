"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Sprout } from "lucide-react";
import { getPublicStats, getCareerInterestCoverage } from "@/lib/data";
import { CAREER_AREAS } from "@/lib/constants";

export default function LandingPage() {
  const [stats, setStats] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const pathRef = useRef(null);
  const svgWrapRef = useRef(null);

  useEffect(() => {
    getPublicStats().then(setStats).catch((e) => console.error("[EkaGuru] getPublicStats failed:", e));
    getCareerInterestCoverage().then(setCoverage).catch((e) => console.error("[EkaGuru] getCareerInterestCoverage failed:", e));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!pathRef.current || !svgWrapRef.current) return;
      const rect = svgWrapRef.current.getBoundingClientRect();
      const progress = (window.innerHeight - rect.top) / (rect.height + window.innerHeight);
      if (progress > 0.15) pathRef.current.classList.add("drawn");
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="bg-[#FAF6EF] text-[#1B2A4A] overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');
        .display { font-family: 'Zilla Slab', serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .path-line { fill: none; stroke: #E8A33D; stroke-width: 3; stroke-dasharray: 2000; stroke-dashoffset: 2000; transition: stroke-dashoffset 2.5s ease-out; }
        .path-line.drawn { stroke-dashoffset: 0; }
      `}</style>

      <header className="px-8 py-7 flex items-center gap-2 text-[#0F6B5C] font-bold text-sm tracking-wide uppercase">
        <Sprout size={16} /> EkaGuru · ఏకగురు
      </header>

      <div ref={svgWrapRef} className="relative max-w-[1000px] mx-auto px-8">
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1400" preserveAspectRatio="none">
          <path ref={pathRef} className="path-line" d="M 120 60 L 780 340 L 220 620 L 780 900 L 500 1250" />
        </svg>

        <section className="relative pt-16 pb-16">
          <h1 className="display font-bold leading-[1.08] max-w-[640px] mb-5" style={{ fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}>
            A path to a career, guided by someone who's already walked it.
          </h1>
          <p className="max-w-[480px] text-[#5B5343] text-base leading-relaxed mb-7">
            Inspired by Ekalavya, who mastered his craft without a guru by his side — EkaGuru connects
            students across Telangana and Andhra Pradesh with volunteer mentors, matched automatically
            by career interest, language, and district.
          </p>
          <Link href="/app" className="inline-flex items-center gap-2 bg-[#E8A33D] hover:bg-[#D6922E] text-[#1B2A4A] font-bold px-6 py-3.5 rounded-lg text-sm transition-colors">
            Find your mentor <ArrowRight size={16} />
          </Link>
        </section>
      </div>

      <section className="bg-[#0F6B5C] text-[#FAF6EF] py-9">
        <div className="max-w-[1000px] mx-auto px-8 flex gap-14 flex-wrap">
          <div>
            <div className="mono font-medium text-[#E8A33D]" style={{ fontSize: "2.2rem" }}>
              {stats ? stats.students : "—"}
            </div>
            <div className="text-xs uppercase tracking-wide opacity-85">Students</div>
          </div>
          <div>
            <div className="mono font-medium text-[#E8A33D]" style={{ fontSize: "2.2rem" }}>
              {stats ? stats.mentors : "—"}
            </div>
            <div className="text-xs uppercase tracking-wide opacity-85">Mentors</div>
          </div>
          <div>
            <div className="mono font-medium text-[#E8A33D]" style={{ fontSize: "2.2rem" }}>
              {stats ? stats.matched : "—"}
            </div>
            <div className="text-xs uppercase tracking-wide opacity-85">Matched</div>
          </div>
        </div>
      </section>

      <div className="relative max-w-[1000px] mx-auto px-8">
        <section className="relative pt-16 pb-24">
          <div className="max-w-[380px] mb-[140px] p-7 bg-white border border-[#E4DCC9] rounded-2xl">
            <div className="display text-xs font-bold text-[#0F6B5C] uppercase tracking-wide mb-1.5">First — you register</div>
            <h3 className="text-xl font-semibold mb-2">Tell us your goal</h3>
            <p className="text-[#5B5343] text-sm leading-relaxed">
              Career interest, language, district, education level. Two minutes, no forms to print, no office to visit.
            </p>
          </div>
          <div className="max-w-[380px] mb-[140px] ml-auto p-7 bg-white border border-[#E4DCC9] rounded-2xl">
            <div className="display text-xs font-bold text-[#0F6B5C] uppercase tracking-wide mb-1.5">Then — we match</div>
            <h3 className="text-xl font-semibold mb-2">Automatically, instantly</h3>
            <p className="text-[#5B5343] text-sm leading-relaxed">
              No waitlist committee. A rule-based match runs the moment you register, balancing load fairly across every available mentor.
            </p>
          </div>
          <div className="max-w-[380px] p-7 bg-white border border-[#E4DCC9] rounded-2xl">
            <div className="display text-xs font-bold text-[#0F6B5C] uppercase tracking-wide mb-1.5">Then — you connect</div>
            <h3 className="text-xl font-semibold mb-2">Straight to WhatsApp</h3>
            <p className="text-[#5B5343] text-sm leading-relaxed">
              Your mentor's number arrives with an icebreaker already written. No app to learn, no new inbox to check.
            </p>
          </div>
        </section>

        <section className="pb-20">
          <div className="text-xs uppercase tracking-wide text-[#0F6B5C] font-bold mb-1.5">Live coverage</div>
          <h2 className="display text-2xl font-bold mb-6">Where mentors are available right now, by subject</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-[560px] mb-4">
            {CAREER_AREAS.map((area) => {
              const status = coverage?.[area];
              const bg = status === "open" ? "#0F6B5C" : status === "full" ? "#E8A33D" : "#D8CFBE";
              return (
                <div key={area} title={area} className="aspect-square rounded flex items-end p-1.5" style={{ backgroundColor: bg }}>
                  <span className="text-[9px] leading-tight text-white font-medium">{area}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-6 flex-wrap text-sm text-[#5B5343]">
            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: "#0F6B5C" }} /> Mentor available</div>
            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: "#E8A33D" }} /> Mentors at capacity</div>
            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: "#D8CFBE" }} /> No mentor yet</div>
          </div>
        </section>

        <section className="text-center pb-24">
          <h2 className="display font-bold mb-5" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
            Your path starts with one registration.
          </h2>
          <Link href="/app" className="inline-flex items-center gap-2 bg-[#E8A33D] hover:bg-[#D6922E] text-[#1B2A4A] font-bold px-6 py-3.5 rounded-lg text-sm transition-colors">
            Join as a student <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}
