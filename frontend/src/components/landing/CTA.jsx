import React from "react";

import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Users,
} from "lucide-react";

export default function CTA() {
  return (
    <section
      id="bring-praxis"
      className="border-t border-slate-200 bg-[#F8FAFC] px-4 py-10 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-[20px] border border-blue-200 bg-blue-600 p-5 text-white shadow-lg shadow-blue-200/50 sm:rounded-[32px] sm:bg-gradient-to-br sm:from-blue-600 sm:via-blue-600 sm:to-indigo-600 sm:p-14 sm:shadow-2xl sm:shadow-blue-200/60">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/15 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-50 backdrop-blur">
            Start with one assignment
          </span>

          <h2 className="mt-4 text-2xl font-bold leading-tight sm:mt-5 sm:text-5xl">
            Bring Praxis to your class.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-blue-50/90 sm:mt-5 sm:text-lg sm:leading-7">
            Set up a course, add your students, write your first
            task, bring your rubric, and guide the assignment from
            planning through instructor feedback.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <MiniItem
              icon={BookOpen}
              text="Create a course"
            />

            <MiniItem
              icon={Users}
              text="Add students"
            />

            <MiniItem
              icon={ClipboardCheck}
              text="Bring your rubric"
            />
          </div>

          <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              to="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-bold text-blue-700 shadow-lg transition hover:-translate-y-px hover:bg-blue-50 sm:w-auto"
            >
              Create an account
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/login"
              className="w-full rounded-2xl border border-white/25 bg-white/10 px-8 py-4 text-center text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniItem({
  icon: Icon,
  text,
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-blue-50 backdrop-blur">
      <Icon className="h-4 w-4" />
      {text}
    </span>
  );
}
