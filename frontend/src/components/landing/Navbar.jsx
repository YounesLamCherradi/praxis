import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Navbar() {
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll =
        document.documentElement.scrollHeight - window.innerHeight;

      if (totalScroll > 0) {
        const currentProgress = (window.scrollY / totalScroll) * 100;
        setScrollProgress(currentProgress);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollToSection = (id) => {
    const targetElement = document.getElementById(id);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="fixed top-4 left-0 right-0 z-40 px-4 sm:px-6 lg:px-10">
      <div className="absolute top-[-16px] left-0 w-full h-[3px] bg-slate-100/50 pointer-events-none z-50">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all duration-75 ease-out shadow-[0_0_8px_rgba(59,130,246,0.45)]"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <nav className="max-w-[1440px] mx-auto bg-white/85 backdrop-blur-xl border border-slate-200/50 rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.04)] px-6 sm:px-10 py-4 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div className="w-11 h-11 rounded-2xl bg-white border border-blue-100 shadow-md shadow-blue-100/70 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                width="256"
                height="256"
                className="w-9 h-9 object-contain"
              />
            </div>

            <span className="text-2xl font-bold tracking-tight leading-none">
              <span className="text-blue-600">p</span>
              <span className="text-slate-900">raxis</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => handleScrollToSection("platform-view")}
              className="text-sm font-bold text-slate-600 hover:text-blue-600 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-200 cursor-pointer"
            >
              AUI Platform Portal
            </button>

            <button
              onClick={() => handleScrollToSection("toolkit")}
              className="text-sm font-bold text-slate-600 hover:text-blue-600 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-200 cursor-pointer"
            >
              Key Features
            </button>

            <button
              onClick={() => handleScrollToSection("why")}
              className="text-sm font-bold text-slate-600 hover:text-blue-600 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-200 cursor-pointer"
            >
              Academic Philosophy
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-bold text-slate-600 hover:text-blue-600 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
            >
              Sign In
            </button>

            <button
              onClick={() => navigate("/signup")}
              className="text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10 px-5 py-3 rounded-2xl flex items-center gap-2 transition-all hover:translate-y-[-1px] hover:shadow-blue-600/20 cursor-pointer"
            >
              Get Started
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
