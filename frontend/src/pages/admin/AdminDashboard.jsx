import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  getPraxisData,
  savePraxisData,
} from "../../services/praxisMockStore";

import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Copy,
  Database,
  FileText,
  GraduationCap,
  Layers,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";

function normalizeAssignmentStatus(assignment) {
  const value = String(
    assignment?.status ||
      assignment?.publicationStatus ||
      assignment?.state ||
      ""
  ).toLowerCase();

  if (
    value === "published" ||
    value === "active" ||
    assignment?.isPublished === true ||
    assignment?.published === true
  ) {
    return "Published";
  }

  return "Draft";
}

function normalizeSubmissionStatus(status) {
  const value = String(status || "Not Started").toLowerCase();

  if (value === "graded") return "Graded";
  if (value === "submitted") return "Submitted";
  if (value === "late") return "Late";
  if (value === "missing") return "Missing";
  if (value === "reopened") return "Reopened";
  if (value === "draft" || value === "in progress") return "In Progress";

  return "Not Started";
}

function getStatusClass(status) {
  if (status === "Published" || status === "Active" || status === "Graded") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (status === "Submitted") {
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  }

  if (status === "Draft" || status === "In Progress") {
    return "bg-slate-50 text-slate-600 border-slate-200";
  }

  if (status === "Unpublished" || status === "Disabled") {
    return "bg-slate-100 text-slate-500 border-slate-200";
  }

  if (status === "Upcoming") {
    return "bg-sky-50 text-sky-700 border-sky-200";
  }

  if (status === "Late" || status === "Reopened") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (status === "Missing" || status === "Removed") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-slate-50 text-slate-500 border-slate-200";
}

function getInitials(nameOrEmail) {
  const clean = String(nameOrEmail || "Admin").trim();

  const parts = clean
    .replace(/@.*/, "")
    .split(/[.\s_-]+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getReadableDate(value) {
  if (!value) return "-";

  return String(value).slice(0, 10);
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(() => getPraxisData());

  const [systemMessage, setSystemMessage] = useState("");
  const [systemError, setSystemError] = useState("");

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("All");

  const [courseSearch, setCourseSearch] = useState("");
  const [courseStatusFilter, setCourseStatusFilter] = useState("All");

  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState("All");

  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("All");

  const classes = data.classes || [];
  const enrollments = data.enrollments || [];
  const assignments = data.assignments || [];
  const submissions = data.submissions || [];
  const rubrics = data.rubrics || [];
  const storedUsers = data.users || [];

  useEffect(() => {
    refreshData();

    const handleStorageChange = (event) => {
      if (!event.key || event.key === "praxis_mock_data") {
        refreshData();
      }
    };

    const handleFocus = () => {
      refreshData();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  function refreshData() {
    setData(getPraxisData());
  }

  function persistData(nextData, successMessage = "") {
    savePraxisData(nextData);
    setData(nextData);

    if (successMessage) {
      setSystemMessage(successMessage);
      setSystemError("");
    }
  }

  async function handleLogout() {
    try {
      await signOut();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }

  function getCourseStatus(course) {
    if (course?.isPublished === false) {
      return "Unpublished";
    }

    if (!course?.start || !course?.finish) {
      return "Published";
    }

    const now = new Date();
    const start = new Date(course.start);
    const finish = new Date(course.finish);

    if (now < start) return "Upcoming";
    if (now > finish) return "Concluded";

    return "Published";
  }

  function getCourseEnrollments(course) {
    return enrollments.filter((enrollment) => {
      const sameClassId =
        enrollment.classId &&
        course.id &&
        String(enrollment.classId) === String(course.id);

      const sameClassCode =
        enrollment.classCode?.toUpperCase() === course.code?.toUpperCase();

      return sameClassId || sameClassCode;
    });
  }

  function getCourseAssignments(course) {
    return assignments.filter((assignment) => {
      const sameClassId =
        assignment.classId &&
        course.id &&
        String(assignment.classId) === String(course.id);

      const sameClassCode =
        assignment.classCode?.toUpperCase() === course.code?.toUpperCase();

      return sameClassId || sameClassCode;
    });
  }

  function getAssignmentSubmissions(assignment) {
    return submissions.filter(
      (submission) =>
        String(submission.assignmentId) === String(assignment.id)
    );
  }

  const derivedUsers = useMemo(() => {
    const userMap = new Map();

    function addUser(user) {
      const email = String(user.email || "").trim().toLowerCase();

      if (!email) return;

      const existing = userMap.get(email);

      userMap.set(email, {
        id: existing?.id || user.id || `usr_${email}`,
        name: user.name || existing?.name || email,
        email,
        role: user.role || existing?.role || "student",
        status: user.status || existing?.status || "active",
        source: existing?.source
          ? `${existing.source}, ${user.source || "Workspace"}`
          : user.source || "Workspace",
        isSystem: existing?.isSystem || user.isSystem || false,
        lastSeen: user.lastSeen || existing?.lastSeen || null,
      });
    }

    addUser({
      id: "admin_root",
      name: "Admin Account",
      email: "admin@aui.ma",
      role: "admin",
      status: "active",
      source: "System",
      isSystem: true,
    });

    addUser({
      id: "teacher_default",
      name: "Teacher Account",
      email: "instructor@aui.ma",
      role: "teacher",
      status: "active",
      source: "System",
      isSystem: true,
    });

    storedUsers.forEach((user) => {
      addUser({
        ...user,
        source: user.source || "Stored",
      });
    });

    enrollments.forEach((enrollment) => {
      addUser({
        id: enrollment.id,
        name: enrollment.studentName || "Student",
        email: enrollment.studentEmail,
        role: "student",
        status: "active",
        source: "Enrollment",
        lastSeen: enrollment.enrolledAt,
      });
    });

    submissions.forEach((submission) => {
      addUser({
        id: submission.id,
        name: submission.studentName || "Student",
        email: submission.studentEmail,
        role: "student",
        status: "active",
        source: "Submission",
        lastSeen:
          submission.resubmittedAt ||
          submission.submittedAt ||
          submission.createdAt,
      });
    });

    return Array.from(userMap.values()).sort((a, b) => {
      const roleRank = { admin: 1, teacher: 2, student: 3 };
      const roleCompare =
        (roleRank[a.role] || 9) - (roleRank[b.role] || 9);

      if (roleCompare !== 0) return roleCompare;

      return a.email.localeCompare(b.email);
    });
  }, [storedUsers, enrollments, submissions]);

  const stats = useMemo(() => {
    const studentCount = derivedUsers.filter(
      (user) => user.role === "student"
    ).length;

    const teacherCount = derivedUsers.filter(
      (user) => user.role === "teacher"
    ).length;

    const pendingReviewCount = submissions.filter((submission) => {
      const status = normalizeSubmissionStatus(submission.status);
      return (
        status === "Submitted" ||
        status === "Late" ||
        status === "Reopened"
      );
    }).length;

    const publishedCourseCount = classes.filter(
      (course) => getCourseStatus(course) !== "Unpublished"
    ).length;

    return {
      users: derivedUsers.length,
      students: studentCount,
      teachers: teacherCount,
      courses: classes.length,
      publishedCourses: publishedCourseCount,
      assignments: assignments.length,
      submissions: submissions.length,
      pendingReviews: pendingReviewCount,
      rubrics: rubrics.length,
    };
  }, [derivedUsers, classes, assignments, submissions, rubrics]);

  const filteredUsers = useMemo(() => {
    const cleanSearch = userSearch.trim().toLowerCase();

    return derivedUsers.filter((user) => {
      const matchesRole =
        userRoleFilter === "All" || user.role === userRoleFilter;

      const matchesSearch =
        !cleanSearch ||
        user.name?.toLowerCase().includes(cleanSearch) ||
        user.email?.toLowerCase().includes(cleanSearch) ||
        user.role?.toLowerCase().includes(cleanSearch);

      return matchesRole && matchesSearch;
    });
  }, [derivedUsers, userSearch, userRoleFilter]);

  const filteredCourses = useMemo(() => {
    const cleanSearch = courseSearch.trim().toLowerCase();

    return classes.filter((course) => {
      const status = getCourseStatus(course);

      const matchesStatus =
        courseStatusFilter === "All" || status === courseStatusFilter;

      const matchesSearch =
        !cleanSearch ||
        course.name?.toLowerCase().includes(cleanSearch) ||
        course.code?.toLowerCase().includes(cleanSearch) ||
        course.description?.toLowerCase().includes(cleanSearch) ||
        course.semester?.toLowerCase().includes(cleanSearch);

      return matchesStatus && matchesSearch;
    });
  }, [classes, courseSearch, courseStatusFilter]);

  const filteredAssignments = useMemo(() => {
    const cleanSearch = assignmentSearch.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const status = normalizeAssignmentStatus(assignment);

      const matchesStatus =
        assignmentStatusFilter === "All" ||
        status === assignmentStatusFilter;

      const matchesSearch =
        !cleanSearch ||
        assignment.title?.toLowerCase().includes(cleanSearch) ||
        assignment.description?.toLowerCase().includes(cleanSearch) ||
        assignment.classCode?.toLowerCase().includes(cleanSearch) ||
        assignment.className?.toLowerCase().includes(cleanSearch);

      return matchesStatus && matchesSearch;
    });
  }, [assignments, assignmentSearch, assignmentStatusFilter]);

  const filteredSubmissions = useMemo(() => {
    const cleanSearch = submissionSearch.trim().toLowerCase();

    return submissions.filter((submission) => {
      const status = normalizeSubmissionStatus(submission.status);

      const matchesStatus =
        submissionStatusFilter === "All" ||
        status === submissionStatusFilter;

      const matchesSearch =
        !cleanSearch ||
        submission.studentName?.toLowerCase().includes(cleanSearch) ||
        submission.studentEmail?.toLowerCase().includes(cleanSearch) ||
        submission.assignmentTitle?.toLowerCase().includes(cleanSearch) ||
        submission.classCode?.toLowerCase().includes(cleanSearch) ||
        submission.className?.toLowerCase().includes(cleanSearch);

      return matchesStatus && matchesSearch;
    });
  }, [submissions, submissionSearch, submissionStatusFilter]);

  function upsertStoredUser(user, updates) {
    const email = user.email.toLowerCase();

    const existingStoredUsers = data.users || [];
    const exists = existingStoredUsers.some(
      (item) => item.email?.toLowerCase() === email
    );

    const nextUser = {
      id: user.id || `usr_${Date.now()}`,
      name: user.name || email,
      email,
      role: user.role || "student",
      status: user.status || "active",
      source: user.source || "Admin",
      isSystem: user.isSystem || false,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const nextUsers = exists
      ? existingStoredUsers.map((item) =>
          item.email?.toLowerCase() === email
            ? {
                ...item,
                ...nextUser,
              }
            : item
        )
      : [...existingStoredUsers, nextUser];

    persistData(
      {
        ...data,
        users: nextUsers,
      },
      "User updated successfully."
    );
  }

  function handleChangeUserRole(user, nextRole) {
    if (user.isSystem && user.role === "admin") {
      setSystemError("The root admin role cannot be changed.");
      setSystemMessage("");
      return;
    }

    upsertStoredUser(user, {
      role: nextRole,
    });
  }

  function handleToggleUserStatus(user) {
    if (user.isSystem && user.role === "admin") {
      setSystemError("The root admin account cannot be disabled.");
      setSystemMessage("");
      return;
    }

    const nextStatus = user.status === "disabled" ? "active" : "disabled";

    upsertStoredUser(user, {
      status: nextStatus,
    });
  }

  function handleRemoveUser(user) {
    if (user.isSystem) {
      setSystemError("System users cannot be removed.");
      setSystemMessage("");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${user.email} from the mock workspace? This removes matching enrollments and submissions for this user.`
    );

    if (!confirmed) return;

    const email = user.email.toLowerCase();

    const nextUsers = (data.users || []).filter(
      (item) => item.email?.toLowerCase() !== email
    );

    const nextEnrollments = enrollments.filter(
      (enrollment) =>
        enrollment.studentEmail?.toLowerCase() !== email
    );

    const nextSubmissions = submissions.filter(
      (submission) =>
        submission.studentEmail?.toLowerCase() !== email
    );

    persistData(
      {
        ...data,
        users: nextUsers,
        enrollments: nextEnrollments,
        submissions: nextSubmissions,
      },
      `${user.email} removed from the mock workspace.`
    );
  }

  function handleToggleCoursePublication(course) {
    const nextPublished = course.isPublished === false;

    const nextClasses = classes.map((item) =>
      String(item.id) === String(course.id)
        ? {
            ...item,
            isPublished: nextPublished,
          }
        : item
    );

    persistData(
      {
        ...data,
        classes: nextClasses,
      },
      nextPublished
        ? `${course.code} published successfully.`
        : `${course.code} unpublished successfully.`
    );
  }

  function handleRemoveCourse(course) {
    const confirmed = window.confirm(
      `Remove ${course.code}? This also removes its enrollments, assignments, and related submissions from the mock workspace.`
    );

    if (!confirmed) return;

    const relatedAssignmentIds = assignments
      .filter((assignment) => {
        const sameClassId =
          assignment.classId &&
          String(assignment.classId) === String(course.id);

        const sameClassCode =
          assignment.classCode?.toUpperCase() ===
          course.code?.toUpperCase();

        return sameClassId || sameClassCode;
      })
      .map((assignment) => String(assignment.id));

    const nextClasses = classes.filter(
      (item) => String(item.id) !== String(course.id)
    );

    const nextEnrollments = enrollments.filter((enrollment) => {
      const sameClassId =
        enrollment.classId &&
        String(enrollment.classId) === String(course.id);

      const sameClassCode =
        enrollment.classCode?.toUpperCase() ===
        course.code?.toUpperCase();

      return !sameClassId && !sameClassCode;
    });

    const nextAssignments = assignments.filter((assignment) => {
      const sameClassId =
        assignment.classId &&
        String(assignment.classId) === String(course.id);

      const sameClassCode =
        assignment.classCode?.toUpperCase() ===
        course.code?.toUpperCase();

      return !sameClassId && !sameClassCode;
    });

    const nextSubmissions = submissions.filter((submission) => {
      const belongsToCourseAssignment = relatedAssignmentIds.includes(
        String(submission.assignmentId)
      );

      const sameClassCode =
        submission.classCode?.toUpperCase() ===
        course.code?.toUpperCase();

      return !belongsToCourseAssignment && !sameClassCode;
    });

    persistData(
      {
        ...data,
        classes: nextClasses,
        enrollments: nextEnrollments,
        assignments: nextAssignments,
        submissions: nextSubmissions,
      },
      `${course.code} removed from the mock workspace.`
    );
  }

  function handleToggleAssignmentPublication(assignment) {
    const currentStatus = normalizeAssignmentStatus(assignment);
    const nextPublished = currentStatus !== "Published";

    const nextAssignments = assignments.map((item) =>
      String(item.id) === String(assignment.id)
        ? {
            ...item,
            isPublished: nextPublished,
            published: nextPublished,
            status: nextPublished ? "Published" : "Draft",
          }
        : item
    );

    persistData(
      {
        ...data,
        assignments: nextAssignments,
      },
      nextPublished
        ? "Assignment published successfully."
        : "Assignment unpublished successfully."
    );
  }

  function handleRemoveAssignment(assignment) {
    const confirmed = window.confirm(
      `Remove "${assignment.title}"? This also removes related submissions.`
    );

    if (!confirmed) return;

    const nextAssignments = assignments.filter(
      (item) => String(item.id) !== String(assignment.id)
    );

    const nextSubmissions = submissions.filter(
      (submission) =>
        String(submission.assignmentId) !== String(assignment.id)
    );

    persistData(
      {
        ...data,
        assignments: nextAssignments,
        submissions: nextSubmissions,
      },
      "Assignment removed from the mock workspace."
    );
  }

  function handleUpdateSubmissionStatus(submission, nextStatus) {
    const nextSubmissions = submissions.map((item) =>
      String(item.id) === String(submission.id)
        ? {
            ...item,
            status: nextStatus,
            reviewedAt:
              nextStatus === "Graded"
                ? new Date().toISOString().slice(0, 10)
                : item.reviewedAt,
          }
        : item
    );

    persistData(
      {
        ...data,
        submissions: nextSubmissions,
      },
      "Submission status updated."
    );
  }

  function handleRemoveSubmission(submission) {
    const confirmed = window.confirm(
      `Remove submission from ${submission.studentEmail}?`
    );

    if (!confirmed) return;

    const nextSubmissions = submissions.filter(
      (item) => String(item.id) !== String(submission.id)
    );

    persistData(
      {
        ...data,
        submissions: nextSubmissions,
      },
      "Submission removed."
    );
  }

  function rebuildUserIndex() {
    const nextUsers = derivedUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      source: user.source,
      isSystem: user.isSystem,
      updatedAt: new Date().toISOString(),
    }));

    persistData(
      {
        ...data,
        users: nextUsers,
      },
      "User index rebuilt from current workspace data."
    );
  }

  function copyMockSnapshot() {
    const snapshot = JSON.stringify(data, null, 2);

    navigator.clipboard
      ?.writeText(snapshot)
      .then(() => {
        setSystemMessage("Mock workspace snapshot copied to clipboard.");
        setSystemError("");
      })
      .catch(() => {
        setSystemError("Could not copy the mock snapshot.");
        setSystemMessage("");
      });
  }

  function copyText(text, successMessage) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setSystemMessage(successMessage);
        setSystemError("");
      })
      .catch(() => {
        setSystemError("Copy failed.");
        setSystemMessage("");
      });
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8FAFC] flex font-sans antialiased text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <style>{`
        .blueprint-grid {
          background-image: linear-gradient(to right, rgba(37, 99, 235, 0.045) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(37, 99, 235, 0.045) 1px, transparent 1px);
          background-size: 3rem 3rem;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      <aside className="w-68 h-full bg-slate-950 text-slate-200 flex flex-col justify-between shrink-0 shadow-2xl relative z-20">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white border border-blue-400/20 shadow-md shadow-blue-500/10 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                className="w-9 h-9 object-contain"
              />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">
                <span className="text-blue-400">p</span>
                <span className="text-white">raxis</span>
              </h1>

              <p className="text-[9px] font-mono font-bold text-blue-300 uppercase tracking-wider mt-1.5">
                Admin Dashboard
              </p>
            </div>
          </div>

          <div className="p-5 space-y-7 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block px-3 mb-2">
                Platform Control
              </span>

              <AdminNavButton
                active={activeTab === "overview"}
                icon={ClipboardList}
                label="Overview"
                onClick={() => setActiveTab("overview")}
              />

              <AdminNavButton
                active={activeTab === "users"}
                icon={UserCog}
                label="Users"
                badge={stats.users}
                onClick={() => setActiveTab("users")}
              />

              <AdminNavButton
                active={activeTab === "courses"}
                icon={Layers}
                label="Courses"
                badge={stats.courses}
                onClick={() => setActiveTab("courses")}
              />

              <AdminNavButton
                active={activeTab === "assignments"}
                icon={BookOpen}
                label="Assignments"
                badge={stats.assignments}
                onClick={() => setActiveTab("assignments")}
              />

              <AdminNavButton
                active={activeTab === "submissions"}
                icon={FileText}
                label="Submissions"
                badge={stats.submissions}
                badgeTone="indigo"
                onClick={() => setActiveTab("submissions")}
              />

              <AdminNavButton
                active={activeTab === "system"}
                icon={Settings}
                label="System"
                onClick={() => setActiveTab("system")}
              />
            </div>

            <div className="pt-5 border-t border-slate-800/80 space-y-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block px-3">
                Health
              </span>

              <div className="bg-slate-950/45 border border-slate-800/60 rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5 font-mono">
                    <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                    Mock Store
                  </span>

                  <span className="font-mono font-bold text-blue-600 text-[10px]">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1.5 border-t border-slate-800/50">
                  <span>Pending Reviews:</span>
                  <span className="font-bold text-white">
                    {stats.pendingReviews}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800/80 bg-slate-950/20 space-y-3">
          <div className="flex items-center gap-3 px-1 py-0.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-xs font-mono font-black text-white shadow-md shadow-blue-600/20">
              AD
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">
                Admin Account
              </h4>

              <p className="text-[9px] font-mono text-slate-400 truncate">
                admin@aui.ma
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-left cursor-pointer"
          >
            <LogOut className="w-4 h-4 stroke-[1.8]" />
            Log Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Workspace</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

            <span className="text-slate-950 font-bold uppercase tracking-wider font-mono">
              {activeTab} Panel
            </span>
          </div>

          <button
            type="button"
            onClick={refreshData}
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative blueprint-grid">
          <div className="max-w-7xl mx-auto h-full flex flex-col relative z-10 space-y-8">
            {(systemMessage || systemError) && (
              <div
                className={`rounded-2xl border p-4 flex items-center gap-3 text-sm font-bold ${
                  systemError
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}
              >
                {systemError ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}

                <span>{systemError || systemMessage}</span>
              </div>
            )}

            {activeTab === "overview" && (
              <div className="space-y-6 animate-fade-in-up">
                <div>
                  <h2 className="font-serif text-2xl font-black text-slate-900">
                    Platform Overview
                  </h2>

                  <p className="text-sm text-slate-400 mt-1">
                    Monitor courses, users, assignments, submissions, and system
                    health from one admin workspace.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <AdminMetricCard
                    icon={Users}
                    label="Users"
                    value={stats.users}
                    description={`${stats.students} students · ${stats.teachers} teachers`}
                    tone="blue"
                  />

                  <AdminMetricCard
                    icon={Layers}
                    label="Courses"
                    value={stats.courses}
                    description={`${stats.publishedCourses} published courses`}
                    tone="sky"
                  />

                  <AdminMetricCard
                    icon={BookOpen}
                    label="Assignments"
                    value={stats.assignments}
                    description="Writing tasks configured"
                    tone="indigo"
                  />

                  <AdminMetricCard
                    icon={FileText}
                    label="Pending Reviews"
                    value={stats.pendingReviews}
                    description={`${stats.submissions} total submissions`}
                    tone="amber"
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Panel title="Recent Courses" subtitle="Latest courses in the mock workspace">
                    {classes.length === 0 ? (
                      <EmptyState text="No courses yet." />
                    ) : (
                      <div className="space-y-3">
                        {classes.slice(0, 5).map((course) => {
                          const status = getCourseStatus(course);

                          return (
                            <div
                              key={course.id}
                              className="flex items-center justify-between gap-3 bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {course.name}
                                </p>

                                <p className="text-[11px] font-mono text-slate-400 truncate">
                                  {course.code} · {course.semester}
                                </p>
                              </div>

                              <StatusBadge status={status} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Panel>

                  <Panel title="Recent Submissions" subtitle="Latest student activity">
                    {submissions.length === 0 ? (
                      <EmptyState text="No submissions yet." />
                    ) : (
                      <div className="space-y-3">
                        {[...submissions]
                          .sort((a, b) => {
                            const aTime = new Date(
                              a.resubmittedAt ||
                                a.submittedAt ||
                                a.createdAt ||
                                0
                            ).getTime();

                            const bTime = new Date(
                              b.resubmittedAt ||
                                b.submittedAt ||
                                b.createdAt ||
                                0
                            ).getTime();

                            return bTime - aTime;
                          })
                          .slice(0, 5)
                          .map((submission) => {
                            const status = normalizeSubmissionStatus(
                              submission.status
                            );

                            return (
                              <div
                                key={submission.id}
                                className="flex items-center justify-between gap-3 bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">
                                    {submission.studentName || "Student"}
                                  </p>

                                  <p className="text-[11px] font-mono text-slate-400 truncate">
                                    {submission.assignmentTitle ||
                                      "Assignment"}{" "}
                                    · {submission.classCode || "Course"}
                                  </p>
                                </div>

                                <StatusBadge status={status} />
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            )}

            {activeTab === "users" && (
              <Panel
                title="User Management"
                subtitle="Search, review, disable, remove, or change mock user roles."
                rightAction={
                  <button
                    type="button"
                    onClick={rebuildUserIndex}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700"
                  >
                    <UserCog className="w-4 h-4" />
                    Rebuild User Index
                  </button>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-4">
                  <SearchInput
                    value={userSearch}
                    onChange={setUserSearch}
                    placeholder="Search users..."
                  />

                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-slate-400"
                  >
                    <option value="All">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                  </select>
                </div>

                <div className="overflow-hidden border border-slate-200 rounded-2xl">
                  <div className="hidden lg:grid grid-cols-[1.5fr_0.8fr_0.8fr_1fr_1.4fr] gap-4 px-5 py-3 bg-[#F8FAFC] text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    <span>User</span>
                    <span>Role</span>
                    <span>Status</span>
                    <span>Source</span>
                    <span className="text-right">Actions</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <EmptyState text="No users found." />
                    ) : (
                      filteredUsers.map((user) => (
                        <div
                          key={user.email}
                          className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.8fr_0.8fr_1fr_1.4fr] gap-3 lg:gap-4 px-5 py-4 items-center bg-white hover:bg-[#F8FAFC]/60"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-black font-mono shrink-0">
                              {getInitials(user.name || user.email)}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {user.name}
                              </p>

                              <p className="text-[11px] text-slate-400 font-mono truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>

                          <select
                            value={user.role}
                            disabled={user.isSystem && user.role === "admin"}
                            onChange={(e) =>
                              handleChangeUserRole(user, e.target.value)
                            }
                            className="bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 disabled:opacity-50"
                          >
                            <option value="admin">Admin</option>
                            <option value="teacher">Teacher</option>
                            <option value="student">Student</option>
                          </select>

                          <StatusBadge
                            status={
                              user.status === "disabled"
                                ? "Disabled"
                                : "Active"
                            }
                          />

                          <p className="text-xs text-slate-400 truncate">
                            {user.source || "Workspace"}
                          </p>

                          <div className="flex flex-wrap lg:justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(user)}
                              className={`inline-flex items-center gap-1.5 border text-xs font-bold px-3 py-2 rounded-xl ${
                                user.status === "disabled"
                                  ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-white"
                              }`}
                            >
                              {user.status === "disabled"
                                ? "Enable"
                                : "Disable"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveUser(user)}
                              disabled={user.isSystem}
                              className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Panel>
            )}

            {activeTab === "courses" && (
              <Panel
                title="Course Monitoring"
                subtitle="Monitor, publish, unpublish, copy codes, or remove courses."
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-4">
                  <SearchInput
                    value={courseSearch}
                    onChange={setCourseSearch}
                    placeholder="Search courses..."
                  />

                  <select
                    value={courseStatusFilter}
                    onChange={(e) => setCourseStatusFilter(e.target.value)}
                    className="bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-slate-400"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Published">Published</option>
                    <option value="Unpublished">Unpublished</option>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Concluded">Concluded</option>
                  </select>
                </div>

                <div className="overflow-hidden border border-slate-200 rounded-2xl">
                  <div className="hidden lg:grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1.3fr] gap-4 px-5 py-3 bg-[#F8FAFC] text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    <span>Course</span>
                    <span>Status</span>
                    <span>Students</span>
                    <span>Assignments</span>
                    <span className="text-right">Actions</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {filteredCourses.length === 0 ? (
                      <EmptyState text="No courses found." />
                    ) : (
                      filteredCourses.map((course) => {
                        const status = getCourseStatus(course);
                        const courseEnrollments = getCourseEnrollments(course);
                        const courseAssignments = getCourseAssignments(course);

                        return (
                          <div
                            key={course.id}
                            className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1.3fr] gap-3 lg:gap-4 px-5 py-4 items-center bg-white hover:bg-[#F8FAFC]/60"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {course.name}
                              </p>

                              <p className="text-[11px] font-mono text-slate-400 truncate">
                                {course.code} · {course.semester || "Semester"}
                              </p>
                            </div>

                            <StatusBadge status={status} />

                            <p className="text-xs font-bold text-slate-700">
                              {courseEnrollments.length} /{" "}
                              {course.maxStudents || 30}
                            </p>

                            <p className="text-xs font-bold text-slate-700">
                              {courseAssignments.length}
                            </p>

                            <div className="flex flex-wrap lg:justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  copyText(
                                    course.code,
                                    `${course.code} copied.`
                                  )
                                }
                                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-slate-50"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleCoursePublication(course)
                                }
                                className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-white"
                              >
                                {course.isPublished === false
                                  ? "Publish"
                                  : "Unpublish"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveCourse(course)}
                                className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-red-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </Panel>
            )}

            {activeTab === "assignments" && (
              <Panel
                title="Assignment Monitoring"
                subtitle="Review assignments across all courses."
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-4">
                  <SearchInput
                    value={assignmentSearch}
                    onChange={setAssignmentSearch}
                    placeholder="Search assignments..."
                  />

                  <select
                    value={assignmentStatusFilter}
                    onChange={(e) =>
                      setAssignmentStatusFilter(e.target.value)
                    }
                    className="bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-slate-400"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>

                <div className="overflow-hidden border border-slate-200 rounded-2xl">
                  <div className="hidden lg:grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_1.2fr] gap-4 px-5 py-3 bg-[#F8FAFC] text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    <span>Assignment</span>
                    <span>Course</span>
                    <span>Status</span>
                    <span>Submissions</span>
                    <span className="text-right">Actions</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {filteredAssignments.length === 0 ? (
                      <EmptyState text="No assignments found." />
                    ) : (
                      filteredAssignments.map((assignment) => {
                        const status = normalizeAssignmentStatus(assignment);
                        const count =
                          getAssignmentSubmissions(assignment).length;

                        return (
                          <div
                            key={assignment.id}
                            className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_1.2fr] gap-3 lg:gap-4 px-5 py-4 items-center bg-white hover:bg-[#F8FAFC]/60"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {assignment.title || "Untitled Assignment"}
                              </p>

                              <p className="text-[11px] text-slate-400 truncate">
                                {assignment.description ||
                                  "No description provided."}
                              </p>
                            </div>

                            <p className="text-xs font-mono font-bold text-slate-600">
                              {assignment.classCode || "-"}
                            </p>

                            <StatusBadge status={status} />

                            <p className="text-xs font-bold text-slate-700">
                              {count}
                            </p>

                            <div className="flex flex-wrap lg:justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleAssignmentPublication(assignment)
                                }
                                className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-white"
                              >
                                {status === "Published"
                                  ? "Unpublish"
                                  : "Publish"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveAssignment(assignment)
                                }
                                className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-red-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </Panel>
            )}

            {activeTab === "submissions" && (
              <Panel
                title="Submission Monitoring"
                subtitle="Monitor and clean submission records."
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-4">
                  <SearchInput
                    value={submissionSearch}
                    onChange={setSubmissionSearch}
                    placeholder="Search submissions..."
                  />

                  <select
                    value={submissionStatusFilter}
                    onChange={(e) =>
                      setSubmissionStatusFilter(e.target.value)
                    }
                    className="bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-slate-400"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Graded">Graded</option>
                    <option value="Reopened">Reopened</option>
                    <option value="Late">Late</option>
                    <option value="Missing">Missing</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>

                <div className="overflow-hidden border border-slate-200 rounded-2xl">
                  <div className="hidden lg:grid grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_1.1fr] gap-4 px-5 py-3 bg-[#F8FAFC] text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    <span>Student</span>
                    <span>Assignment</span>
                    <span>Course</span>
                    <span>Status</span>
                    <span>Date</span>
                    <span className="text-right">Actions</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {filteredSubmissions.length === 0 ? (
                      <EmptyState text="No submissions found." />
                    ) : (
                      filteredSubmissions.map((submission) => {
                        const status = normalizeSubmissionStatus(
                          submission.status
                        );

                        return (
                          <div
                            key={submission.id}
                            className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_1.1fr] gap-3 lg:gap-4 px-5 py-4 items-center bg-white hover:bg-[#F8FAFC]/60"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {submission.studentName || "Student"}
                              </p>

                              <p className="text-[11px] font-mono text-slate-400 truncate">
                                {submission.studentEmail || "-"}
                              </p>
                            </div>

                            <p className="text-xs font-bold text-slate-700 truncate">
                              {submission.assignmentTitle || "Assignment"}
                            </p>

                            <p className="text-xs font-mono font-bold text-slate-600">
                              {submission.classCode || "-"}
                            </p>

                            <StatusBadge status={status} />

                            <p className="text-xs text-slate-500">
                              {getReadableDate(
                                submission.resubmittedAt ||
                                  submission.submittedAt ||
                                  submission.createdAt
                              )}
                            </p>

                            <div className="flex flex-wrap lg:justify-end gap-2">
                              <select
                                value={status}
                                onChange={(e) =>
                                  handleUpdateSubmissionStatus(
                                    submission,
                                    e.target.value
                                  )
                                }
                                className="bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2"
                              >
                                <option value="Submitted">Submitted</option>
                                <option value="Graded">Graded</option>
                                <option value="Reopened">Reopened</option>
                                <option value="Late">Late</option>
                                <option value="Missing">Missing</option>
                                <option value="In Progress">In Progress</option>
                              </select>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveSubmission(submission)
                                }
                                className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-red-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </Panel>
            )}

            {activeTab === "system" && (
              <div className="space-y-6 animate-fade-in-up">
                <Panel
                  title="System Settings"
                  subtitle="Mock workspace tools for frontend testing before backend integration."
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SystemActionCard
                      icon={RefreshCw}
                      title="Refresh Store"
                      description="Reload the latest mock data from localStorage."
                      action="Refresh"
                      onClick={refreshData}
                    />

                    <SystemActionCard
                      icon={UserCog}
                      title="Rebuild Users"
                      description="Create a user index from enrollments and submissions."
                      action="Rebuild"
                      onClick={rebuildUserIndex}
                    />

                    <SystemActionCard
                      icon={Database}
                      title="Copy Snapshot"
                      description="Copy the full mock workspace JSON for debugging."
                      action="Copy JSON"
                      onClick={copyMockSnapshot}
                    />
                  </div>
                </Panel>

                <Panel
                  title="Mock Store Summary"
                  subtitle="Current local frontend data size."
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MiniStat label="Classes" value={classes.length} />
                    <MiniStat label="Enrollments" value={enrollments.length} />
                    <MiniStat label="Assignments" value={assignments.length} />
                    <MiniStat label="Submissions" value={submissions.length} />
                    <MiniStat label="Rubrics" value={rubrics.length} />
                    <MiniStat label="Users" value={derivedUsers.length} />
                    <MiniStat
                      label="Published Courses"
                      value={stats.publishedCourses}
                    />
                    <MiniStat
                      label="Pending Reviews"
                      value={stats.pendingReviews}
                    />
                  </div>
                </Panel>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AdminNavButton({
  active,
  icon: Icon,
  label,
  badge,
  badgeTone = "blue",
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all text-left group cursor-pointer border ${
        active
          ? "bg-slate-800/80 text-white border-slate-700 shadow-inner"
          : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/30"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon
          className={`w-4 h-4 stroke-[1.8] ${
            active ? "text-blue-300" : "text-slate-500"
          }`}
        />

        <span>{label}</span>
      </div>

      {badge !== undefined && (
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            active
              ? badgeTone === "indigo"
                ? "bg-indigo-500 text-white"
                : "bg-blue-600 text-white"
              : "bg-slate-800 text-slate-500"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function AdminMetricCard({ icon: Icon, label, value, description, tone }) {
  const styles = {
    blue: {
      icon: "bg-blue-50 border-blue-100 text-blue-700",
      label: "text-blue-700 bg-blue-50 border-blue-100",
    },
    sky: {
      icon: "bg-sky-50 border-sky-100 text-sky-700",
      label: "text-sky-700 bg-sky-50 border-sky-100",
    },
    indigo: {
      icon: "bg-indigo-50 border-indigo-100 text-indigo-700",
      label: "text-indigo-700 bg-indigo-50 border-indigo-100",
    },
    amber: {
      icon: "bg-amber-50 border-amber-200 text-amber-700",
      label: "text-amber-700 bg-amber-50 border-amber-200",
    },
  };

  const selected = styles[tone] || styles.blue;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-start gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <div
        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${selected.icon}`}
      >
        <Icon className="w-5 h-5 stroke-[1.8]" />
      </div>

      <div className="space-y-1 min-w-0">
        <span
          className={`text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border inline-block ${selected.label}`}
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

function Panel({ title, subtitle, rightAction, children }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-slate-900">
            {title}
          </h3>

          {subtitle && (
            <p className="text-xs text-slate-400 font-medium mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {rightAction}
      </div>

      {children}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-slate-400"
      />
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex w-fit text-[9px] font-mono font-bold uppercase border px-2 py-1 rounded ${getStatusClass(
        status
      )}`}
    >
      {status}
    </span>
  );
}

function EmptyState({ text }) {
  return (
    <div className="p-8 text-center text-xs text-slate-400 font-mono">
      {text}
    </div>
  );
}

function SystemActionCard({ icon: Icon, title, description, action, onClick }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 space-y-4">
      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
        <Icon className="w-5 h-5" />
      </div>

      <div>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>

        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="w-full bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all"
      >
        {action}
      </button>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="text-xl font-serif font-bold text-slate-900 mt-1">
        {value}
      </p>
    </div>
  );
}