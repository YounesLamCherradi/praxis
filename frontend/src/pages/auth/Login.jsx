import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    if (!email.trim() || !password) {
      setError("Please fill in all required login fields.");
      setLoading(false);
      return;
    }

    if (!email.trim().toLowerCase().endsWith("@aui.ma")) {
      setError("Portal access is restricted to verified @aui.ma accounts.");
      setLoading(false);
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();

      const profile = await signIn(cleanEmail, password, stayLoggedIn);

      if (profile.role === "student") {
        navigate("/student");
      } else if (profile.role === "teacher") {
        navigate("/teacher");
      } else if (profile.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(
        err.message ||
          "Invalid campus credentials. Please check your information."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC] text-slate-900">
      <style>{`
        .login-grid {
          background-image:
            linear-gradient(to right, rgba(37, 99, 235, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37, 99, 235, 0.045) 1px, transparent 1px);
          background-size: 3rem 3rem;
        }

        @keyframes loginFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes loginPulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        .login-float {
          animation: loginFloat 5s ease-in-out infinite;
        }

        .login-pulse {
          animation: loginPulse 3s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 login-grid opacity-80" />
      <div className="absolute -top-40 left-1/4 w-[560px] h-[560px] rounded-full bg-blue-500/15 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 right-0 w-[520px] h-[520px] rounded-full bg-indigo-500/15 blur-[130px] pointer-events-none" />

      <div className="absolute top-6 left-6 sm:left-10 z-20">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="group flex items-center gap-3 bg-white/85 hover:bg-white backdrop-blur border border-slate-200 shadow-sm pl-3 pr-5 py-2 rounded-2xl transition-all duration-200 cursor-pointer text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-50 group-hover:bg-blue-600 group-hover:text-white text-blue-700 border border-blue-100 flex items-center justify-center transition-all duration-200 shrink-0">
            <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform" />
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700 transition-colors leading-none">
              Back to Home
            </span>

            <span className="text-[9px] font-mono text-slate-500 mt-0.5 uppercase tracking-wider">
              praxis website
            </span>
          </div>
        </button>
      </div>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-center px-10 xl:px-16 pt-24 pb-12">
          <div className="max-w-xl login-float">
            <div className="inline-flex items-center gap-3 bg-white/85 backdrop-blur border border-blue-100 px-4 py-2 rounded-2xl shadow-sm mb-8">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                <img
                  src="/praxis-logo.png"
                  alt="Praxis logo"
                  className="w-7 h-7 object-contain"
                />
              </div>

              <span className="text-xl font-bold tracking-tight leading-none">
                <span className="text-blue-600">p</span>
                <span className="text-slate-900">raxis</span>
              </span>

              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                AUI Writing Platform
              </span>
            </div>

            <h1 className="font-serif text-5xl xl:text-6xl font-black tracking-tight leading-[0.98] text-slate-950">
              Secure access to your writing workspace.
            </h1>

            <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-lg">
              Sign in to continue your guided writing process, review feedback,
              manage submissions, or access instructors tools inside Praxis.
            </p>

            <div className="mt-8 grid gap-3 max-w-md">
              <LoginBenefit
                icon={Sparkles}
                title="AI-supported writing"
                text="Brainstorm, organize, revise, and improve responsibly."
              />

              <LoginBenefit
                icon={GraduationCap}
                title="Instructor review"
                text="Access rubrics, annotations, grades, and feedback."
              />

              <LoginBenefit
                icon={ShieldCheck}
                title="Process visibility"
                text="Writing progress and review evidence stay connected."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-4 sm:px-6 lg:px-10 py-28 lg:py-12">
          <div className="w-full max-w-md">
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-blue-950/10 rounded-3xl p-6 sm:p-8">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-white border border-blue-100 shadow-md shadow-blue-100/70 flex items-center justify-center overflow-hidden">
                  <img
                    src="/praxis-logo.png"
                    alt="Praxis logo"
                    className="w-11 h-11 object-contain"
                  />
                </div>

                <h2 className="text-2xl font-serif font-black text-slate-950">
                  Welcome back
                </h2>

                <p className="text-xs font-mono uppercase text-blue-700 font-bold tracking-wider mt-1">
                  AUI secure access
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wide">
                    Campus Email
                  </label>

                  <div className="mt-1.5 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="username@aui.ma"
                      required
                      className="block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wide">
                    Password
                  </label>

                  <div className="mt-1.5 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>

                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stayLoggedIn}
                      onChange={(e) => setStayLoggedIn(e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-600 border-slate-300 cursor-pointer"
                    />
                    Remember me
                  </label>

                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    @aui.ma only
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <>
                      Sign in to Portal
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-600">
                Don&apos;t have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className="font-bold text-blue-700 hover:text-blue-800 ml-1 cursor-pointer bg-transparent border-none p-0 align-baseline"
                >
                  Register here
                </button>
              </div>
            </div>

            <div className="mt-5 text-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Praxis · AUI Writing Platform · Secure Workspace
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginBenefit({ icon: Icon, title, text }) {
  return (
    <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-4 flex gap-3 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}