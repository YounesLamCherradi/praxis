import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CheckSquare,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  Layers,
  LogOut,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkle,
  X,
} from "lucide-react";

import { useStudentWorkspace } from "../../contexts/StudentWorkspaceContext.jsx";
import { useAuth } from "../../contexts/AuthContext";
import {
  getPraxisData,
  savePraxisData,
} from "../../services/praxisMockStore";

import AssignmentTray from "./AssignmentTray.jsx";
import ActiveAssignmentWorkflow from "./ActiveAssignmentWorkflow.jsx";

function normalizeCourseCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function getCourseCode(course = {}) {
  return normalizeCourseCode(
    course.code ||
      course.courseCode ||
      course.classCode ||
      course.joinCode ||
      ""
  );
}

function getStudentEmail(authUser, authProfile) {
  return (
    authUser?.email ||
    authProfile?.email ||
    authProfile?.studentEmail ||
    "student@aui.ma"
  )
    .trim()
    .toLowerCase();
}

function getStudentName(authUser, authProfile) {
  return (
    authProfile?.fullName ||
    authProfile?.name ||
    authProfile?.studentName ||
    authUser?.user_metadata?.full_name ||
    authUser?.user_metadata?.name ||
    "Student Account"
  );
}

export default function StudentDashboard() {
  const navigate = useNavigate();

  const {
    signOut,
    user: authUser,
    profile: authProfile,
  } = useAuth() || {};

  const {
    classes = [],
    currentClassId = "__all__",
    setCurrentClassId,
    selectedAssignmentId,
    assignments = [],
    submissions = [],
    refreshStudentWorkspace,
  } = useStudentWorkspace();

  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [courseCodeInput, setCourseCodeInput] = useState("");
  const [enrollError, setEnrollError] = useState("");
  const [enrollSuccess, setEnrollSuccess] = useState("");
  const [isJoiningCourse, setIsJoiningCourse] = useState(false);

  const studentEmail = useMemo(
    () => getStudentEmail(authUser, authProfile),
    [authUser, authProfile]
  );

  const studentName = useMemo(
    () => getStudentName(authUser, authProfile),
    [authUser, authProfile]
  );

  const totalAssignmentsCount = assignments.length;

  const submittedCount = submissions.filter(
    (submission) =>
      String(submission?.status || "").toLowerCase() === "submitted"
  ).length;

  const draftCount = submissions.filter(
    (submission) =>
      String(submission?.status || "").toLowerCase() === "draft"
  ).length;

  const pendingCount = Math.max(
    totalAssignmentsCount - submittedCount,
    0
  );

  async function handleLogout() {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  function openEnrollModal() {
    setCourseCodeInput("");
    setEnrollError("");
    setEnrollSuccess("");
    setIsEnrollOpen(true);
  }

  function closeEnrollModal() {
    if (isJoiningCourse) return;

    setIsEnrollOpen(false);
    setCourseCodeInput("");
    setEnrollError("");
    setEnrollSuccess("");
  }

  function courseIsAlreadyJoined(course, enrollments = []) {
    const targetCourseId = String(course?.id || "");
    const targetCourseCode = getCourseCode(course);

    const existsInWorkspace = classes.some((joinedCourse) => {
      const sameId =
        targetCourseId &&
        String(joinedCourse?.id || "") === targetCourseId;

      const sameCode =
        targetCourseCode &&
        getCourseCode(joinedCourse) === targetCourseCode;

      return sameId || sameCode;
    });

    if (existsInWorkspace) {
      return true;
    }

    return enrollments.some((enrollment) => {
      const enrollmentEmail = String(
        enrollment?.studentEmail ||
          enrollment?.email ||
          ""
      )
        .trim()
        .toLowerCase();

      const sameStudent = enrollmentEmail === studentEmail;

      const sameClassId =
        targetCourseId &&
        String(enrollment?.classId || enrollment?.courseId || "") ===
          targetCourseId;

      const enrollmentCode = normalizeCourseCode(
        enrollment?.classCode ||
          enrollment?.courseCode ||
          enrollment?.code ||
          ""
      );

      const sameClassCode =
        targetCourseCode &&
        enrollmentCode === targetCourseCode;

      return sameStudent && (sameClassId || sameClassCode);
    });
  }

  async function handleEnrollCourseCode(event) {
    event.preventDefault();

    setEnrollError("");
    setEnrollSuccess("");

    const enteredCode = normalizeCourseCode(courseCodeInput);

    if (!enteredCode) {
      setEnrollError("Please enter a valid course code.");
      return;
    }

    setIsJoiningCourse(true);

    try {
      const data = getPraxisData();

      const allCourses = Array.isArray(data.classes)
        ? data.classes
        : [];

      const enrollments = Array.isArray(data.enrollments)
        ? data.enrollments
        : [];

      const matchedCourse = allCourses.find((course) => {
        return getCourseCode(course) === enteredCode;
      });

      if (!matchedCourse) {
        setEnrollError(
          "Invalid course code. Please check the code provided by your professor."
        );
        return;
      }

      if (matchedCourse.isPublished === false) {
        setEnrollError(
          "This course is currently unpublished. Please contact your professor."
        );
        return;
      }

      if (courseIsAlreadyJoined(matchedCourse, enrollments)) {
        setEnrollError("You are already enrolled in this course.");

        if (typeof setCurrentClassId === "function") {
          setCurrentClassId(matchedCourse.id);
        }

        return;
      }

      const now = new Date().toISOString();
      const matchedCourseCode = getCourseCode(matchedCourse);

      const newEnrollment = {
        id: `enrollment_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,

        studentEmail,
        studentName,

        classId: matchedCourse.id,
        courseId: matchedCourse.id,

        classCode: matchedCourseCode,
        courseCode: matchedCourseCode,

        className:
          matchedCourse.name ||
          matchedCourse.title ||
          matchedCourseCode,

        status: "active",
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const updatedEnrollments = [
        ...enrollments,
        newEnrollment,
      ];

      savePraxisData({
        ...data,
        enrollments: updatedEnrollments,
      });

      setEnrollSuccess(
        `${matchedCourseCode} verified. The course workspace is now available.`
      );

      setCourseCodeInput("");

      if (typeof setCurrentClassId === "function") {
        setCurrentClassId(matchedCourse.id);
      }

      if (typeof refreshStudentWorkspace === "function") {
        await Promise.resolve(refreshStudentWorkspace());
      }

      window.setTimeout(() => {
        setIsEnrollOpen(false);
        setEnrollSuccess("");

        /*
         * Reload only when the workspace context does not expose a refresh
         * function. This ensures the newly joined course appears immediately.
         */
        if (typeof refreshStudentWorkspace !== "function") {
          window.location.reload();
        }
      }, 1400);
    } catch (error) {
      console.error("Course enrollment failed:", error);

      setEnrollError(
        "The course could not be joined. Please refresh the page and try again."
      );
    } finally {
      setIsJoiningCourse(false);
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8FAFC] flex font-sans antialiased text-slate-950 selection:bg-blue-100 selection:text-blue-900">
      <style>{`
        .blueprint-grid {
          background-image:
            linear-gradient(
              to right,
              rgba(37, 99, 235, 0.045) 1px,
              transparent 1px
            ),
            linear-gradient(
              to bottom,
              rgba(37, 99, 235, 0.045) 1px,
              transparent 1px
            );
          background-size: 3rem 3rem;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulseBreathe {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: 0.85;
            transform: scale(0.96);
          }
        }

        .animate-fade-in-up {
          animation:
            fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .status-pulse {
          animation:
            pulseBreathe 2s infinite ease-in-out;
        }

        .glow-box-draft:hover {
          box-shadow:
            0 12px 30px -10px rgba(37, 99, 235, 0.16),
            0 0 0 1px rgba(37, 99, 235, 0.24);
          border-color: rgba(37, 99, 235, 0.35);
        }

        .glow-box-pending:hover {
          box-shadow:
            0 12px 30px -10px rgba(79, 70, 229, 0.16),
            0 0 0 1px rgba(79, 70, 229, 0.24);
          border-color: rgba(79, 70, 229, 0.35);
        }

        .glow-box-verified:hover {
          box-shadow:
            0 12px 30px -10px rgba(14, 165, 233, 0.16),
            0 0 0 1px rgba(14, 165, 233, 0.24);
          border-color: rgba(14, 165, 233, 0.35);
        }
      `}</style>

      <aside className="w-68 h-screen sticky top-0 bg-slate-950 text-slate-200 flex flex-col justify-between shrink-0 shadow-2xl relative z-20">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white border border-blue-400/20 shadow-md shadow-blue-500/10 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                className="w-9 h-9 object-contain"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight leading-none">
                <span className="text-blue-400">p</span>
                <span className="text-white">raxis</span>
              </h1>

              <p className="text-[9px] font-mono font-bold text-blue-300 uppercase tracking-wider mt-1.5">
                Student Dashboard
              </p>
            </div>
          </div>

          <div className="p-5 space-y-7 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-3 mb-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block">
                  Active Courses
                </span>

                <button
                  type="button"
                  onClick={openEnrollModal}
                  className="text-[10px] font-mono font-bold text-blue-300 hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Join
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCurrentClassId("__all__")}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group cursor-pointer border ${
                  currentClassId === "__all__"
                    ? "bg-blue-600/15 text-white border-blue-400/30 shadow-inner"
                    : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers
                    className={`w-4 h-4 stroke-[1.8] ${
                      currentClassId === "__all__"
                        ? "text-blue-300"
                        : "text-slate-500"
                    }`}
                  />

                  <span>All Courses</span>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    currentClassId === "__all__"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {totalAssignmentsCount}
                </span>
              </button>

              {classes.map((course) => {
                const classCount = assignments.filter(
                  (assignment) =>
                    assignment &&
                    String(assignment.classId) ===
                      String(course.id)
                ).length;

                const isSelected =
                  String(currentClassId) === String(course.id);

                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => setCurrentClassId(course.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group cursor-pointer border ${
                      isSelected
                        ? "bg-blue-600/15 text-white border-blue-400/30 shadow-inner"
                        : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <BookOpen
                        className={`w-4 h-4 stroke-[1.8] shrink-0 ${
                          isSelected
                            ? "text-blue-300"
                            : "text-slate-500"
                        }`}
                      />

                      <span className="truncate">
                        {course.name
                          ? course.name.split(":")[0]
                          : getCourseCode(course) || course.id}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {classCount}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-5 border-t border-slate-800/80 space-y-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block px-3">
                System Status
              </span>

              <div className="bg-slate-950/45 border border-slate-800/60 rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5 font-mono">
                    <Activity className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
                    Workspace Sync
                  </span>

                  <span className="font-mono font-bold text-blue-300 text-[10px]">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1.5 border-t border-slate-800/50">
                  <span>Pending review:</span>

                  <span className="font-bold text-white">
                    {pendingCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800/80 bg-slate-950/20 space-y-3">
          <div className="flex items-center gap-3 px-1 py-0.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-mono font-black shadow-md shadow-blue-600/20">
              ST
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">
                {studentName}
              </h4>

              <p className="text-[9px] font-mono text-slate-400 truncate">
                {studentEmail}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all text-left cursor-pointer"
          >
            <LogOut className="w-4 h-4 stroke-[1.8]" />
            Log Out
          </button>
        </div>
      </aside>

      <main className="flex-1 h-screen flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Workspace</span>

            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

            <span className="text-slate-950 font-bold">
              {currentClassId === "__all__"
                ? "All Course Workspaces"
                : classes.find(
                    (course) =>
                      String(course.id) ===
                      String(currentClassId)
                  )?.name || "Course Workspace"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://reactjs.org/link/error-boundaries"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              Help Docs
            </a>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative blueprint-grid">
          <div className="max-w-7xl mx-auto min-h-full flex flex-col relative z-10 space-y-8">
            {!selectedAssignmentId && (
              <div className="bg-gradient-to-r from-blue-50 to-white border border-blue-100/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in-up">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkle className="w-4 h-4 text-blue-600" />
                    Course Access Window
                  </h3>

                  <p className="text-xs text-slate-500 max-w-xl">
                    Has your professor provided a course code? Enter
                    it to load your writing workspace and assigned
                    prompts.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openEnrollModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20 cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
                >
                  Enter Course Code
                </button>
              </div>
            )}

            {selectedAssignmentId ? (
              <ActiveAssignmentWorkflow />
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up [animation-delay:100ms]">
                  <StudentMetricCard
                    cardType="draft"
                    icon={FileText}
                    label="Active Drafts"
                    value={`${draftCount || 0} Workspaces`}
                    description="Unlocked prompts ready for student drafting steps."
                    tone="blue"
                    pulse
                  />

                  <StudentMetricCard
                    cardType="pending"
                    icon={Clock}
                    label="Awaiting Review"
                    value={`${pendingCount} Tasks`}
                    description="Assignments queued for teacher review and feedback."
                    tone="indigo"
                  />

                  <StudentMetricCard
                    cardType="verified"
                    icon={ShieldCheck}
                    label="Submitted Work"
                    value={`${submittedCount} Complete`}
                    description="Completed submissions with process visibility attached."
                    tone="sky"
                  />
                </div>

                <div className="space-y-2 animate-fade-in-up [animation-delay:150ms]">
                  <div className="space-y-1">
                    <h2 className="font-serif text-2xl font-black text-slate-900">
                      Course Assignment Workspaces
                    </h2>

                    <p className="text-xs text-slate-400 font-medium">
                      Select an active assignment to start drafting,
                      receive AI guidance, and submit your work.
                    </p>
                  </div>

                  <AssignmentTray />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {isEnrollOpen && (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={closeEnrollModal}
              disabled={isJoiningCourse}
              className="absolute right-5 top-5 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Close join-course modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                <BookOpen className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Join a Professor&apos;s Course
                </h3>

                <p className="text-xs leading-relaxed text-slate-500">
                  Enter the course code issued by your instructor to
                  access the course workspace and assigned writing
                  prompts.
                </p>
              </div>

              <form
                onSubmit={handleEnrollCourseCode}
                className="space-y-4 pt-2"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                    Course access code
                  </label>

                  <input
                    type="text"
                    value={courseCodeInput}
                    disabled={isJoiningCourse}
                    onChange={(event) => {
                      setCourseCodeInput(
                        normalizeCourseCode(event.target.value)
                      );

                      if (enrollError) {
                        setEnrollError("");
                      }

                      if (enrollSuccess) {
                        setEnrollSuccess("");
                      }
                    }}
                    placeholder="e.g. FAS1949"
                    autoComplete="off"
                    maxLength={12}
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-xs font-mono uppercase text-slate-900 shadow-inner transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {enrollError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

                    <span className="font-semibold leading-relaxed">
                      {enrollError}
                    </span>
                  </div>
                )}

                {enrollSuccess && (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0" />

                    <span className="font-semibold leading-relaxed">
                      {enrollSuccess}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isJoiningCourse ||
                    !normalizeCourseCode(courseCodeInput)
                  }
                  className="w-full rounded-xl bg-blue-600 py-3.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isJoiningCourse
                    ? "Checking course..."
                    : "Verify Code & Join Course"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentMetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
  cardType,
  pulse,
}) {
  const toneStyles = {
    blue: {
      icon: "bg-blue-50 border-blue-100 text-blue-600",
      label: "text-blue-700 bg-blue-50 border-blue-100",
    },

    indigo: {
      icon: "bg-indigo-50 border-indigo-100 text-indigo-600",
      label:
        "text-indigo-700 bg-indigo-50 border-indigo-100",
    },

    sky: {
      icon: "bg-sky-50 border-sky-100 text-sky-600",
      label: "text-sky-700 bg-sky-50 border-sky-100",
    },
  };

  const styles = toneStyles[tone] || toneStyles.blue;

  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl p-5 flex items-start gap-4 transition-all duration-300 hover:-translate-y-1 ${
        cardType ? `glow-box-${cardType}` : ""
      } cursor-default`}
    >
      <div
        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${styles.icon}`}
      >
        <Icon className="w-5 h-5 stroke-[1.8]" />
      </div>

      <div className="space-y-1 min-w-0">
        <span
          className={`text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border inline-block ${
            styles.label
          } ${pulse ? "status-pulse" : ""}`}
        >
          {label}
        </span>

        <h4 className="text-xl font-serif font-bold text-slate-900">
          {value}
        </h4>

        <p className="text-[11px] text-slate-400 font-medium">
          {description}
        </p>
      </div>
    </div>
  );
}