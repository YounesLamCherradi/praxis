import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import AuthService from "../../services/auth";
import {
  getPendingCourseInvite,
  normalizeCourseInviteCode,
  rememberPendingCourseInvite,
} from "../../utils/courseInvite.js";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [inviteCode] = useState(
    () =>
      normalizeCourseInviteCode(searchParams.get("invite")) ||
      getPendingCourseInvite()
  );
  const { signUp, setUser } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [countdownNow, setCountdownNow] = useState(0);
  const [codeRequested, setCodeRequested] = useState(false);

  useEffect(() => {
    if (inviteCode) rememberPendingCourseInvite(inviteCode);
  }, [inviteCode]);

  useEffect(() => {
    if (!resendAt) return undefined;
    const timer = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  const waitSeconds = Math.max(0, Math.ceil((resendAt - countdownNow) / 1000));
  const cleanEmail = email.trim().toLowerCase();
  const isAuiEmail = cleanEmail.endsWith("@aui.ma") && cleanEmail.includes("@");
  const canRequestCode = isAuiEmail;
  const passwordChecks = {
    length: password.length >= 10,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const passwordRules = [
    { key: "length", label: "At least 10 characters" },
    { key: "lower", label: "One lowercase letter" },
    { key: "upper", label: "One uppercase letter" },
    { key: "number", label: "One number" },
    { key: "special", label: "One special character" },
  ];

  function passwordHint(pass) {
    return [
      pass.length >= 10,
      /[a-z]/.test(pass),
      /[A-Z]/.test(pass),
      /\d/.test(pass),
      /[^A-Za-z0-9]/.test(pass),
    ].every(Boolean);
  }

  async function handleRequestCode() {
    setCodeLoading(true);
    setError("");
    setMessage("");

    try {
      if (!email.trim()) {
        throw new Error("Enter your email first.");
      }

      if (!isAuiEmail) {
        throw new Error("Access is restricted to @aui.ma accounts.");
      }

      await AuthService.requestSignupCode(cleanEmail, name.trim());
      const requestedAt = Date.now();
      setCountdownNow(requestedAt);
      setResendAt(requestedAt + 60 * 1000);
      setCodeRequested(true);
      setMessage("A 6-digit verification code was sent to your email.");
    } catch (err) {
      setError(err.message || "Could not send verification code.");
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    if (!name.trim() || !email.trim() || !password || !otpCode.trim()) {
      setError("Please fill in all required registration fields.");
      setLoading(false);
      return;
    }

    if (!isAuiEmail) {
      setError("Access is restricted to @aui.ma accounts.");
      setLoading(false);
      return;
    }

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError("Enter a valid 6-digit verification code.");
      setLoading(false);
      return;
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      setError("Password must be 10+ chars and include uppercase, lowercase, number, and special character.");
      setLoading(false);
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();

      const profile = await signUp(
        name.trim(),
        cleanEmail,
        password,
        inviteCode ? "student" : role,
        otpCode.trim()
      );

      setUser(profile);

      if (inviteCode || role === "student") {
        navigate(inviteCode ? `/join?code=${encodeURIComponent(inviteCode)}` : "/student");
      } else if (role === "teacher") {
        navigate("/teacher");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.message || "Failed to create your Praxis workspace.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC] text-slate-900">
      <style>{`
        .signup-grid {
          background-image:
            linear-gradient(to right, rgba(37, 99, 235, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37, 99, 235, 0.045) 1px, transparent 1px);
          background-size: 3rem 3rem;
        }

        @keyframes signupFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes signupPulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        .signup-float {
          animation: signupFloat 5s ease-in-out infinite;
        }

        .signup-pulse {
          animation: signupPulse 3s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 signup-grid opacity-80" />
      <div className="absolute -top-40 left-1/4 w-[560px] h-[560px] rounded-full bg-blue-500/15 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 right-0 w-[520px] h-[520px] rounded-full bg-indigo-500/15 blur-[130px] pointer-events-none" />

      <div className="absolute top-6 left-6 sm:left-10 z-20">
        <button
          type="button"
          onClick={() =>
            navigate(inviteCode ? `/login?invite=${encodeURIComponent(inviteCode)}` : "/login")
          }
          className="group flex items-center gap-3 bg-white/85 hover:bg-white backdrop-blur border border-slate-200 shadow-sm pl-3 pr-5 py-2 rounded-2xl transition-all duration-200 cursor-pointer text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-50 group-hover:bg-blue-600 group-hover:text-white text-blue-700 border border-blue-100 flex items-center justify-center transition-all duration-200 shrink-0">
            <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform" />
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700 transition-colors leading-none">
              Back to Login
            </span>

            <span className="text-[9px] font-mono text-slate-500 mt-0.5 uppercase tracking-wider">
              praxis website
            </span>
          </div>
        </button>
      </div>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-center px-10 xl:px-16 pt-24 pb-12">
          <div className="max-w-xl signup-float">
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
              Create your academic writing workspace.
            </h1>

            <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-lg">
              Register with your AUI account to access guided writing,
              instructors review tools, responsible AI support, and transparent
              writing process workflows.
            </p>

            <div className="mt-8 grid gap-3 max-w-md">
              <SignupBenefit
                icon={BookOpen}
                title="Course-based access"
                text="Students join courses and instructors manage assignments."
              />

              <SignupBenefit
                icon={Sparkles}
                title="Responsible AI support"
                text="AI helps with thinking and revision without replacing ownership."
              />

              <SignupBenefit
                icon={ShieldCheck}
                title="Transparent process"
                text="Drafting, feedback, and review stay connected in one platform."
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
                  Register workspace
                </h2>

                <p className="text-xs font-mono uppercase text-blue-700 font-bold tracking-wider mt-1">
                   Join the AUI platform · email code required
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {message && (
                <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-800 font-medium">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSignup}>
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wide">
                    Full Name
                  </label>

                  <div className="mt-1.5 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>

                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Kenza Alami"
                      required
                      className="block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wide">
                    Campus Email Address <span className="ml-1 text-[10px] normal-case font-medium text-slate-500">(AUI accounts only)</span>
                  </label>

                  <div className="mt-1.5 flex gap-2">
                    <div className="relative rounded-xl shadow-sm flex-1">
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

                    {canRequestCode && (
                      <button
                        type="button"
                        onClick={handleRequestCode}
                        disabled={codeLoading || waitSeconds > 0}
                        className="px-4 py-3 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 shadow-lg shadow-blue-600/20"
                      >
                        {codeLoading ? "Sending..." : waitSeconds > 0 ? `${waitSeconds}s` : "Get code"}
                      </button>
                    )}
                  </div>
                </div>

                {codeRequested && (
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wide">
                      6-Digit Verification Code
                    </label>

                    <div className="mt-1.5 relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>

                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        maxLength={6}
                        required
                        className="block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm tracking-[0.35em] font-mono focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-white"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wide">
                    Create Password
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

                  {password.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {passwordRules.map((rule) => {
                        const satisfied = passwordChecks[rule.key];
                        return (
                          <div
                            key={rule.key}
                            className={`flex items-center gap-2 text-[11px] font-medium ${satisfied ? "text-emerald-700" : "text-rose-600"}`}
                          >
                            <span
                              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${satisfied ? "bg-emerald-100" : "bg-rose-100"}`}
                            >
                              {satisfied ? "✓" : "•"}
                            </span>
                            <span>{rule.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Campus Academic Role
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole("student")}
                      className={`py-3 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        role === "student"
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                          : "bg-white border-slate-300 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                      }`}
                    >
                      Student
                    </button>

                    <button
                      type="button"
                      onClick={() => !inviteCode && setRole("teacher")}
                      disabled={Boolean(inviteCode)}
                      className={`py-3 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        role === "teacher"
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                          : "bg-white border-slate-300 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                      }`}
                    >
                      Instructor
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    <>
                      Create Workspace
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-xs text-slate-600">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() =>
                    navigate(inviteCode ? `/login?invite=${encodeURIComponent(inviteCode)}` : "/login")
                  }
                  className="font-bold text-blue-700 hover:text-blue-800 ml-1 cursor-pointer bg-transparent border-none p-0 align-baseline"
                >
                  Sign in
                </button>
              </div>
            </div>

            <div className="mt-5 text-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Praxis · AUI Writing Platform · Secure Registration
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignupBenefit({ icon: Icon, title, text }) {
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
