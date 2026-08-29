import React, { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import AuthService from "../../services/auth";

const RESEND_SECONDS = 60;
const RESET_CODE_PENDING_KEY = "praxis-password-reset-code-pending-v1";
const RESET_CODE_COOLDOWN_MS = RESEND_SECONDS * 1000;

export default function ForgotPasswordDialog({ open, onClose }) {
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [countdownNow, setCountdownNow] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("request");

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
  useEffect(() => {
    if (!resendAt) return undefined;
    const timer = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  useEffect(() => {
    if (!open) return;
    try {
      const pending = JSON.parse(
        window.sessionStorage.getItem(RESET_CODE_PENDING_KEY) || "null"
      );
      const requestedAt = Number(pending?.requestedAt || 0);
      if (
        !pending?.email ||
        !requestedAt ||
        Date.now() - requestedAt >= RESET_CODE_COOLDOWN_MS
      ) {
        window.sessionStorage.removeItem(RESET_CODE_PENDING_KEY);
        return;
      }

      setEmail(String(pending.email));
      setCountdownNow(Date.now());
      setResendAt(requestedAt + RESET_CODE_COOLDOWN_MS);
      setStep("reset");
      setMessage(
        "A password-reset request is already in progress. Check your inbox before requesting another code."
      );
    } catch {
      window.sessionStorage.removeItem(RESET_CODE_PENDING_KEY);
    }
  }, [open]);

  const waitSeconds = Math.max(0, Math.ceil((resendAt - countdownNow) / 1000));

  if (!open) return null;

  async function handleRequestCode(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.endsWith("@aui.ma")) {
        throw new Error("Access is restricted to @aui.ma accounts.");
      }

      const requestedAt = Date.now();
      setCountdownNow(requestedAt);
      setResendAt(requestedAt + RESET_CODE_COOLDOWN_MS);
      setStep("reset");
      window.sessionStorage.setItem(
        RESET_CODE_PENDING_KEY,
        JSON.stringify({ email: cleanEmail, requestedAt })
      );

      await AuthService.requestPasswordResetCode(cleanEmail);
      setMessage("If the account exists, a 6-digit code has been sent. Please check your inbox.");
    } catch (err) {
      setError(err.message || "Could not send code right now.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = code.trim();

      if (!/^\d{6}$/.test(cleanCode)) {
        throw new Error("Enter a valid 6-digit code.");
      }
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      if (!Object.values(passwordChecks).every(Boolean)) {
        throw new Error("Password does not meet security requirements.");
      }

      await AuthService.resetPasswordWithCode(cleanEmail, cleanCode, password);
      window.sessionStorage.removeItem(RESET_CODE_PENDING_KEY);
      setMessage("Password updated. You can now sign in with the new password.");
      setStep("done");
    } catch (err) {
      setError(err.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (waitSeconds > 0 || loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      const requestedAt = Date.now();
      setCountdownNow(requestedAt);
      setResendAt(requestedAt + RESET_CODE_COOLDOWN_MS);
      window.sessionStorage.setItem(
        RESET_CODE_PENDING_KEY,
        JSON.stringify({ email: cleanEmail, requestedAt })
      );

      await AuthService.requestPasswordResetCode(cleanEmail);
      setMessage("If the account exists, a new code has been sent.");
    } catch (err) {
      setError(err.message || "Could not resend code.");
    } finally {
      setLoading(false);
    }
  }

  function closeAndReset() {
    setEmail("");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setResendAt(0);
    setCountdownNow(0);
    setMessage("");
    setError("");
    setStep("request");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-2 backdrop-blur-sm sm:p-3 xl:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-h-[92dvh] sm:p-5 2xl:rounded-3xl 2xl:p-6">
        <h3 className="text-xl font-bold text-slate-950">Reset password</h3>
        <p className="text-xs text-blue-700 mt-1">Use your email verification code to set a new password.</p>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
            <span>{message}</span>
          </div>
        )}

        {step === "request" && (
          <form onSubmit={handleRequestCode} className="mt-5 space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-semibold text-slate-700">Campus email</label>
              <div className="mt-1.5 relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="username@aui.ma"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Send 6-digit code
            </button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
            <div>
              <label htmlFor="reset-code" className="block text-sm font-semibold text-slate-700">Verification code</label>
              <div className="mt-1.5 relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-code"
                  type="text"
                  name="one-time-code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm tracking-[0.35em] font-mono focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reset-password" className="block text-sm font-semibold text-slate-700">New password</label>
              <div className="relative mt-1.5">
                <input
                  id="reset-password"
                  type={showResetPassword ? "text" : "password"}
                  name="new-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-4 pr-11 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <button
                  type="button"
                  data-password-toggle="showResetPassword"
                  onClick={() => setShowResetPassword((current) => !current)}
                  aria-label={showResetPassword ? "Hide password" : "Show password"}
                  aria-pressed={showResetPassword}
                  title={showResetPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 z-10 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-blue-600 focus:text-blue-600 focus:outline-none cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle cx="12" cy="12" r="2.5" />
                    {showResetPassword && <path d="M4 4l16 16" />}
                  </svg>
                </button>
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
              <label htmlFor="reset-password-confirmation" className="block text-sm font-semibold text-slate-700">Confirm new password</label>
              <div className="relative mt-1.5">
                <input
                  id="reset-password-confirmation"
                  type={showResetConfirmPassword ? "text" : "password"}
                  name="new-password-confirmation"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-4 pr-11 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <button
                  type="button"
                  data-password-toggle="showResetConfirmPassword"
                  onClick={() => setShowResetConfirmPassword((current) => !current)}
                  aria-label={showResetConfirmPassword ? "Hide password" : "Show password"}
                  aria-pressed={showResetConfirmPassword}
                  title={showResetConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 z-10 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-blue-600 focus:text-blue-600 focus:outline-none cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                    <circle cx="12" cy="12" r="2.5" />
                    {showResetConfirmPassword && <path d="M4 4l16 16" />}
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || waitSeconds > 0}
                className="inline-flex min-h-11 items-center font-bold text-blue-700 disabled:text-slate-400"
              >
                {waitSeconds > 0 ? `Resend in ${waitSeconds}s` : "Resend code"}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/60 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Update password
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="mt-5">
            <button
              type="button"
              onClick={closeAndReset}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3 rounded-xl"
            >
              Back to sign in
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={closeAndReset}
          className="mt-4 min-h-11 w-full text-xs text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
