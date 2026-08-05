import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white font-sans text-slate-600">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-6">
            <Link
              to="/"
              className="inline-flex items-center gap-3"
              aria-label="Praxis home"
            >
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                width="256"
                height="256"
                className="h-10 w-10 object-contain"
              />

              <span className="text-2xl font-bold tracking-tight">
                <span className="text-slate-900">pr</span>
                <span className="text-blue-600">a</span>
                <span className="text-slate-900">x</span>
                <span className="text-blue-600">i</span>
                <span className="text-slate-900">s</span>
              </span>
            </Link>

            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600">
              Praxis is an academic platform that brings together assignments,
              classroom activities, student work, instructor feedback,
              assessment, and AI-supported learning.
            </p>
          </div>

          {/* Platform links */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-900">
              Platform
            </h3>

            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href="#platform-view"
                  className="transition-colors hover:text-blue-600"
                >
                  Platform Experience
                </a>
              </li>

              <li>
                <a
                  href="#toolkit"
                  className="transition-colors hover:text-blue-600"
                >
                  Key Features
                </a>
              </li>

              <li>
                <a
                  href="#why"
                  className="transition-colors hover:text-blue-600"
                >
                  Learning Approach
                </a>
              </li>
            </ul>
          </div>

          {/* Workspace links */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-900">
              Workspace
            </h3>

            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link
                  to="/login"
                  className="transition-colors hover:text-blue-600"
                >
                  Sign In
                </Link>
              </li>

              <li>
                <Link
                  to="/signup"
                  className="transition-colors hover:text-blue-600"
                >
                  Create Account
                </Link>
              </li>

              <li>
                <Link
                  to="/login"
                  className="transition-colors hover:text-blue-600"
                >
                  Open Workspace
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} Praxis. AUI Academic Platform.
          </p>

          <p>
            Supporting students, instructors, and academic learning.
          </p>
        </div>
      </div>
    </footer>
  );
}
