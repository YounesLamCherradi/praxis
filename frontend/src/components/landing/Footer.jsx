import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const currentYear =
    new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        <div className="grid gap-7 sm:gap-10 md:grid-cols-12">
          <div className="md:col-span-6">
            <Link
              to="/"
              className="inline-flex items-center gap-3"
            >
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                className="h-10 w-10 object-contain"
              />

              <span className="text-2xl font-bold tracking-tight">
                <span className="text-slate-900">
                  pr
                </span>
                <span className="text-blue-600">
                  a
                </span>
                <span className="text-slate-900">
                  x
                </span>
                <span className="text-blue-600">
                  i
                </span>
                <span className="text-slate-900">
                  s
                </span>
              </span>
            </Link>

            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600">
              A writing space for language classes that
              connects student planning, drafting, revision,
              reflection, rubric grading, annotations, and
              instructor feedback.
            </p>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-900">
              Experience
            </h3>

            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href="#role-journey"
                  className="hover:text-blue-600"
                >
                  Student experience
                </a>
              </li>

              <li>
                <a
                  href="#role-journey"
                  className="hover:text-blue-600"
                >
                  Instructor experience
                </a>
              </li>

              <li>
                <a
                  href="#assignment-flow"
                  className="hover:text-blue-600"
                >
                  Assignment flow
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-900">
              Workspace
            </h3>

            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link
                  to="/login"
                  className="hover:text-blue-600"
                >
                  Sign In
                </Link>
              </li>

              <li>
                <Link
                  to="/signup"
                  className="hover:text-blue-600"
                >
                  Create Account
                </Link>
              </li>

              <li>
                <Link
                  to="/login"
                  className="hover:text-blue-600"
                >
                  Open Workspace
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} Praxis. AUI Writing Platform.
          </p>

          <p>
            Supporting writing, feedback, and learning.
          </p>
        </div>
      </div>
    </footer>
  );
}
