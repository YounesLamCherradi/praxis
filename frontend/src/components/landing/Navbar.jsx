import React, {
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  Menu,
  X,
} from "lucide-react";

export default function Navbar() {
  const navigate = useNavigate();

  const [scrollProgress, setScrollProgress] =
    useState(0);

  const [mobileOpen, setMobileOpen] =
    useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const total =
        document.documentElement.scrollHeight -
        window.innerHeight;

      if (total > 0) {
        setScrollProgress(
          (window.scrollY / total) * 100
        );
      }
    };

    window.addEventListener(
      "scroll",
      handleScroll
    );

    return () =>
      window.removeEventListener(
        "scroll",
        handleScroll
      );
  }, []);

  function scrollTo(id) {
    setMobileOpen(false);

    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }

  function goTo(path) {
    setMobileOpen(false);
    navigate(path);
  }

  return (
    <div className="fixed left-0 right-0 top-3 z-40 px-3 sm:top-4 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute left-0 top-[-12px] z-50 h-[3px] w-full bg-slate-100/50 sm:top-[-16px]">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 shadow-[0_0_8px_rgba(59,130,246,.45)] transition-all duration-75"
          style={{
            width: `${scrollProgress}%`,
          }}
        />
      </div>

      <nav className="relative mx-auto max-w-[1440px] rounded-[18px] border border-slate-200/60 bg-white/95 px-2.5 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,.05)] backdrop-blur-xl sm:rounded-[24px] sm:px-10 sm:py-4 sm:shadow-[0_12px_40px_rgba(0,0,0,.05)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm shadow-blue-100/70 sm:h-11 sm:w-11 sm:rounded-2xl sm:shadow-md">
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                className="h-6 w-6 object-contain sm:h-9 sm:w-9"
              />
            </div>

            <span className="text-lg font-bold tracking-tight sm:text-2xl">
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
          </button>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() =>
                scrollTo("role-journey")
              }
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-blue-600"
            >
              Experience
            </button>

            <button
              onClick={() =>
                scrollTo("assignment-flow")
              }
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-blue-600"
            >
              How it works
            </button>

            <button
              onClick={() =>
                scrollTo("ai-approach")
              }
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-blue-600"
            >
              AI Approach
            </button>
          </div>

          {/* Desktop account actions */}
          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() =>
                goTo("/login")
              }
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 hover:text-blue-600"
            >
              Sign In
            </button>

            <button
              onClick={() =>
                goTo("/signup")
              }
              className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/10 transition hover:-translate-y-px hover:bg-blue-700"
            >
              Sign Up

              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile account actions + menu */}
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              type="button"
              onClick={() => goTo("/login")}
              className="rounded-lg px-2.5 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 hover:text-blue-600"
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => goTo("/signup")}
              className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm shadow-blue-600/15 transition hover:bg-blue-700"
            >
              Sign Up
            </button>

            <button
              type="button"
              onClick={() =>
                setMobileOpen(
                  (current) => !current
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              aria-label={
                mobileOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
            }
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="mt-3 border-t border-slate-100 pt-3 md:hidden">
            <div className="space-y-1">
              <MobileNavItem
                onClick={() =>
                  scrollTo("role-journey")
                }
              >
                Experience
              </MobileNavItem>

              <MobileNavItem
                onClick={() =>
                  scrollTo(
                    "assignment-flow"
                  )
                }
              >
                How it works
              </MobileNavItem>

              <MobileNavItem
                onClick={() =>
                  scrollTo("ai-approach")
                }
              >
                AI Approach
              </MobileNavItem>
            </div>

          </div>
        )}
      </nav>
    </div>
  );
}

function MobileNavItem({
  children,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
    >
      {children}

      <ArrowRight className="h-4 w-4 text-slate-300" />
    </button>
  );
}
