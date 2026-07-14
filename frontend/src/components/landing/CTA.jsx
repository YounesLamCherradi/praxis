import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-slate-200">
      <div className="max-w-[1100px] mx-auto bg-gradient-to-tr from-emerald-900 to-indigo-950 text-white rounded-3xl p-8 sm:p-14 relative overflow-hidden shadow-2xl shadow-emerald-900/10">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 mix-blend-overlay" />
        
        <div className="relative z-10 text-center space-y-6 max-w-2xl mx-auto">
          <h2 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight">
            Bring Praxis to your AUI Courses today.
          </h2>
          <p className="text-emerald-200/90 text-base sm:text-lg font-sans">
            Start with safe workspaces for FAS, ENG, or MKT assignments. Invite students, upload standard rubrics, and champion original authorship.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              to="/signup"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-8 py-4 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all hover:translate-y-[-1px]"
            >
              Access Portal Instantly <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}