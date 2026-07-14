import React from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  GraduationCap,
  Globe,
  ShieldCheck,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#F8FAFC] border-t border-slate-200 text-slate-600 py-14 font-sans">
      <div className="absolute -top-32 right-1/4 w-[420px] h-[420px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-[420px] h-[420px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 pb-10 border-b border-slate-200">
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white border border-blue-100 shadow-md shadow-blue-100/70 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="/praxis-logo.png"
                  alt="Praxis logo"
                  className="w-9 h-9 object-contain"
                />
              </div>

              <span className="text-2xl font-bold tracking-tight leading-none">
                <span className="text-blue-600">p</span>
                <span className="text-slate-900">raxis</span>
              </span>
            </div>

            <p className="text-sm text-slate-600 max-w-sm leading-relaxed">
              Praxis helps students plan, write, revise, and submit academic
              assignments while giving instructors clear tools for review,
              feedback, rubrics, annotations, and responsible AI use.
            </p>
          </div>

          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
              Platform
            </h4>

            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="#platform-view"
                  className="hover:text-blue-600 transition-colors"
                >
                  Platform Experience
                </a>
              </li>

              <li>
                <a
                  href="#toolkit"
                  className="hover:text-blue-600 transition-colors"
                >
                  Key Features
                </a>
              </li>

              <li>
                <a
                  href="#why"
                  className="hover:text-blue-600 transition-colors"
                >
                  Writing Philosophy
                </a>
              </li>

              <li>
                <Link
                  to="/login"
                  className="hover:text-blue-600 transition-colors"
                >
                  Workspace Sign In
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
              Responsible Writing
            </h4>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-blue-700 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Process Visibility Protected</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Praxis is built around instructor judgment, student ownership, and
                transparent writing process signals. AI supports learning, but
                students remain responsible for their final work.
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Responsible AI writing support</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-7 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-600" />

            <span>
              &copy; {new Date().getFullYear()} praxis. AUI Writing Platform.
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              Live Environment
            </span>

            <span className="text-slate-300">|</span>

            <span className="text-blue-600 font-bold">
              Process Timeline Syncing
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}