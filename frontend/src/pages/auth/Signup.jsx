import { useEffect, useState } from "react";
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
} from "lucide-react";

const SIGNUP_CODE_PENDING_KEY = "praxis-signup-code-pending-v1";
const SIGNUP_CODE_COOLDOWN_MS = 60 * 1000;

export default function Signup({ accountRole = "student" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [inviteCode] = useState(
    () =>
      normalizeCourseInviteCode(searchParams.get("invite")) ||
      getPendingCourseInvite()
  );
  const signupRole = inviteCode ? "student" : accountRole;
  const isInstructorSignup = signupRole === "teacher";
  const { signUp, setUser } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
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
    try {
      const pending = JSON.parse(
        window.sessionStorage.getItem(SIGNUP_CODE_PENDING_KEY) || "null"
      );
      const requestedAt = Number(pending?.requestedAt || 0);
      if (
        !pending?.email ||
        !requestedAt ||
        Date.now() - requestedAt >= SIGNUP_CODE_COOLDOWN_MS
      ) {
        window.sessionStorage.removeItem(SIGNUP_CODE_PENDING_KEY);
        return;
      }

      setEmail(String(pending.email));
      setCountdownNow(Date.now());
      setResendAt(requestedAt + SIGNUP_CODE_COOLDOWN_MS);
      setCodeRequested(true);
      setMessage(
        "A verification request is already in progress. Check your inbox before requesting another code."
      );
    } catch {
      window.sessionStorage.removeItem(SIGNUP_CODE_PENDING_KEY);
    }
  }, []);

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

      const requestedAt = Date.now();
      setCountdownNow(requestedAt);
      setResendAt(requestedAt + SIGNUP_CODE_COOLDOWN_MS);
      setCodeRequested(true);
      window.sessionStorage.setItem(
        SIGNUP_CODE_PENDING_KEY,
        JSON.stringify({ email: cleanEmail, requestedAt })
      );

      await AuthService.requestSignupCode(cleanEmail, name.trim());
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

    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all required registration fields.");
      setLoading(false);
      return;
    }

    if (!isAuiEmail) {
      setError("Access is restricted to @aui.ma accounts.");
      setLoading(false);
      return;
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      setError("Password must be 10+ chars and include uppercase, lowercase, number, and special character.");
      setLoading(false);
      return;
    }

    if (!codeRequested) {
      try {
        const requestedAt = Date.now();
        await AuthService.requestSignupCode(cleanEmail, name.trim());
        setCountdownNow(requestedAt);
        setResendAt(requestedAt + SIGNUP_CODE_COOLDOWN_MS);
        setCodeRequested(true);
        window.sessionStorage.setItem(
          SIGNUP_CODE_PENDING_KEY,
          JSON.stringify({ email: cleanEmail, requestedAt })
        );
        setMessage("We sent a 6-digit verification code to your email.");
      } catch (err) {
        setError(err.message || "Could not send verification code.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError("Enter the 6-digit verification code from your email.");
      setLoading(false);
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();

      const profile = await signUp(
        name.trim(),
        cleanEmail,
        password,
        signupRole,
        otpCode.trim()
      );

      setUser(profile);

      if (signupRole === "student") {
        navigate(inviteCode ? `/join?code=${encodeURIComponent(inviteCode)}` : "/student");
      } else if (signupRole === "teacher") {
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
              {isInstructorSignup
                ? "Create your instructor workspace."
                : "Create your student writing workspace."}
            </h1>

            <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-lg">
              {isInstructorSignup
                ? "Register with your AUI account to create courses, manage assignments, and review student writing."
                : "Register with your AUI account to join courses and access guided, responsible writing support."}
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
                  {codeRequested
                    ? "Verify your email"
                    : isInstructorSignup
                    ? "Instructor registration"
                    : "Student registration"}
                </h2>

                <p className="text-xs font-mono uppercase text-blue-700 font-bold tracking-wider mt-1">
                  {codeRequested
                    ? "Enter the code to finish registration"
                    : "Join the AUI platform · email code required"}
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {message && !codeRequested && (
                <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-800 font-medium">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{message}</span>
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSignup}>
                {!codeRequested && (
                  <>
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

                  </div>
                </div>
                  </>
                )}

                {codeRequested && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700 shadow-sm">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          Check your email
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          Enter the 6-digit code sent to
                        </p>
                        <p className="truncate text-xs font-bold text-blue-700" title={cleanEmail}>
                          {cleanEmail}
                        </p>
                      </div>
                    </div>

                    <label className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wide">
                      Verification code
                    </label>

                    <div className="mt-1.5 relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>

                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        required
                        className="block w-full pl-10 pr-4 py-3.5 border border-blue-200 rounded-xl text-center text-lg tracking-[0.45em] font-mono font-bold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-white"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setCodeRequested(false);
                          setOtpCode("");
                          setMessage("");
                          setResendAt(0);
                          window.sessionStorage.removeItem(SIGNUP_CODE_PENDING_KEY);
                        }}
                        className="font-bold text-slate-600 hover:text-blue-700"
                      >
                        Change account details
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestCode}
                        disabled={codeLoading || waitSeconds > 0}
                        className="font-bold text-blue-700 disabled:text-slate-400"
                      >
                        {codeLoading ? "Sending…" : waitSeconds > 0 ? `Resend in ${waitSeconds}s` : "Resend code"}
                      </button>
                    </div>
                  </div>
                )}

                {!codeRequested && (
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

                  {password.length > 0 && !codeRequested && (
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
                )}

                {!codeRequested && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
                    {isInstructorSignup ? (
                      <GraduationCap className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    {isInstructorSignup ? "Instructor account" : "Student account"}
                  </div>
                  <p className="mt-1 text-xs text-blue-700">
                    {isInstructorSignup
                      ? "This page creates instructor accounts only."
                      : "This page creates student accounts only."}
                  </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {codeRequested ? "Creating account..." : "Sending code..."}
                    </span>
                  ) : (
                    <>
                      {codeRequested ? "Verify & Create Workspace" : "Sign Up"}
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

              {!inviteCode && (
                <div className="mt-3 text-center text-xs text-slate-500">
                  {isInstructorSignup ? "Are you a student?" : "Are you an instructor?"}{" "}
                  <button
                    type="button"
                    onClick={() => navigate(isInstructorSignup ? "/signup" : "/instructor-signup")}
                    className="font-bold text-blue-700 hover:text-blue-800 ml-1 cursor-pointer bg-transparent border-none p-0 align-baseline"
                  >
                    {isInstructorSignup ? "Create a student account" : "Go to instructor registration"}
                  </button>
                </div>
              )}
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
