import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { joinCourseByCode } from "../services/courseApi.js";
import {
  clearPendingCourseInvite,
  getPendingCourseInvite,
  normalizeCourseInviteCode,
  rememberPendingCourseInvite,
} from "../utils/courseInvite.js";
import { queryClient, queryKeys } from "../queryClient.js";

export default function CourseInvite() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlCode = normalizeCourseInviteCode(searchParams.get("code"));
  const [storedCode] = useState(() => getPendingCourseInvite());
  const code = urlCode || storedCode;
  const attemptedCode = useRef("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (urlCode) rememberPendingCourseInvite(urlCode);
  }, [urlCode]);

  useEffect(() => {
    if (!user || user.role !== "student" || !code || attemptedCode.current === code) return;

    attemptedCode.current = code;
    setError("");

    joinCourseByCode(code)
      .then((result) => {
        const joinedClass = result?.class || {};
        queryClient.invalidateQueries({ queryKey: queryKeys.studentCourses });
        queryClient.invalidateQueries({ queryKey: queryKeys.studentWorkspace });
        clearPendingCourseInvite();
        const params = new URLSearchParams({
          joinedCode: code,
          ...(joinedClass.id ? { joinedCourse: joinedClass.id } : {}),
        });
        navigate(`/student?${params.toString()}`, { replace: true });
      })
      .catch((joinError) => {
        setError(joinError?.message || "This course invitation is unavailable.");
      });
  }, [code, navigate, user]);

  const authSuffix = `?invite=${encodeURIComponent(code)}`;
  const isJoining = Boolean(user?.role === "student" && code && !error);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <BookOpen className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-950">Course invitation</h1>
        <p className="mt-2 text-sm text-slate-600">
          {code ? `Invitation code ${code}` : "This invitation link is incomplete."}
        </p>

        {!code ? (
          <InviteError text="The invitation does not contain a course code. Ask your instructor for a new link." />
        ) : error ? (
          <InviteError text={error} />
        ) : !user ? (
          <div className="mt-7 space-y-3">
            <p className="text-sm text-slate-600">
              Sign in with your student account, or create one. The course will be joined automatically afterward.
            </p>
            <Link className="block rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700" to={`/login${authSuffix}`}>
              Sign in and join
            </Link>
            <Link className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" to={`/signup${authSuffix}`}>
              Create student account
            </Link>
          </div>
        ) : user.role !== "student" ? (
          <InviteError text="Course invitations must be opened with a student account." />
        ) : (
          <div className="mt-7 flex items-center justify-center gap-2 text-sm font-semibold text-blue-700">
            {isJoining ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            Joining your course…
          </div>
        )}
      </section>
    </main>
  );
}

function InviteError({ text }) {
  return (
    <div className="mt-7 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left text-sm text-rose-800">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
