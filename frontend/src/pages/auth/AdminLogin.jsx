import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  Shield,
} from "lucide-react";

const ADMIN_EMAIL = "admin@aui.ma";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!password) {
      setError("Enter the admin password.");
      setLoading(false);
      return;
    }

    try {
      const profile = await signIn(cleanEmail, password, stayLoggedIn);

      if (profile.role !== "admin") {
        setError("This account is not configured as an admin.");
        setLoading(false);
        return;
      }

      navigate("/admin");
    } catch (err) {
      setError(err.message || "Invalid admin credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC] text-slate-900">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(37,99,235,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(37,99,235,0.045)_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-80" />
      <div className="absolute -top-40 left-1/4 h-[560px] w-[560px] rounded-full bg-blue-500/15 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-cyan-400/15 blur-[130px] pointer-events-none" />

      <div className="absolute top-6 left-6 z-20 sm:left-10">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/85 py-2 pl-3 pr-5 text-left shadow-sm backdrop-blur transition-all duration-200 hover:bg-white"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 transition-all duration-200 group-hover:bg-blue-600 group-hover:text-white">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold leading-none text-slate-700 transition-colors group-hover:text-blue-700">
              Back to Home
            </span>
            <span className="mt-0.5 text-[11px] font-medium text-slate-500">
              Praxis website
            </span>
          </div>
        </button>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-28 sm:px-6 lg:px-10">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 backdrop-blur-xl sm:p-8">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-white shadow-md shadow-blue-100/70 text-blue-700">
                <Shield className="h-7 w-7" />
              </div>

              <h1 className="text-3xl font-bold text-slate-950">Administrator sign in</h1>

              <p className="mt-2 text-sm text-slate-600">
                Sign in to manage Praxis courses, accounts, and platform settings.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Administrator email
                </label>

                <div className="relative mt-1.5 rounded-xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={ADMIN_EMAIL}
                    required
                    className="block w-full rounded-xl border border-slate-300 bg-white py-3 pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Password
                </label>

                <div className="relative mt-1.5 rounded-xl shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="block w-full rounded-xl border border-slate-300 bg-white py-3 pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={stayLoggedIn}
                  onChange={(e) => setStayLoggedIn(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                Keep me signed in
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:bg-blue-600/60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
