import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import TeacherAssignments from "./TeacherAssignments";
import TeacherCommunication from "./TeacherCommunication";
import { useTeacherWorkspace } from "../../contexts/TeacherWorkspaceContext.jsx";
import TeacherSubmissions from "./submissions/TeacherSubmissions";
import TeacherRubrics from "./TeacherRubrics";
import { useNavigate } from "react-router-dom";
import {
  getPraxisData,
  savePraxisData,
} from "../../services/praxisMockStore";

import {
  BookOpen,
  Layers,
  Activity,
  LogOut,
  ChevronRight,
  Plus,
  X,
  Sparkle,
  ShieldAlert,
  CheckSquare,
  FileText,
  ShieldCheck,
  ClipboardList,
  Settings,
  Calendar,
  Edit3,
  UserPlus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  MessageSquare,
  Info,
} from "lucide-react";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const {
    classes = [],
    setClasses,
    assignments = [],
    setAssignments,
    submissions = [],
    setSubmissions,
  } = useTeacherWorkspace();

  const [activeTab, setActiveTab] = useState("overview");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [classNameInput, setClassNameInput] = useState("");
  const [courseCodeInput, setCourseCodeInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [semesterInput, setSemesterInput] = useState("Fall 2026");
  const [startDate, setStartDate] = useState("");
  const [finishDate, setFinishDate] = useState("");

  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [expandedClassId, setExpandedClassId] = useState(null);

  const [managedClass, setManagedClass] = useState(null);
  const [managerMode, setManagerMode] = useState("details");

  const [manageCourseForm, setManageCourseForm] = useState({
    name: "",
    code: "",
    description: "",
    semester: "Fall 2026",
    start: "",
    finish: "",
  });

  const [studentNameToAdd, setStudentNameToAdd] = useState("");
  const [studentEmailToAdd, setStudentEmailToAdd] = useState("");

  const [managerError, setManagerError] = useState("");
  const [managerSuccess, setManagerSuccess] = useState("");

  const [enrollments, setEnrollments] = useState(() => {
    return getPraxisData().enrollments || [];
  });

  function refreshEnrollments() {
    const data = getPraxisData();
    setEnrollments(data.enrollments || []);
  }

  useEffect(() => {
    refreshEnrollments();

    const handleStorageChange = (event) => {
      if (!event.key || event.key === "praxis_mock_data") {
        refreshEnrollments();
      }
    };

    const handleFocus = () => {
      refreshEnrollments();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  async function handleLogout() {
    try {
      await signOut();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }

  const isCodeValid = /^[A-Z]{2,5}[0-9]{3,5}$/.test(courseCodeInput);

  function computeCourseStatus(cls) {
    if (cls?.isPublished === false) {
      return {
        text: "Unpublished",
        styles: "bg-slate-500/10 text-slate-500 border-slate-500/20",
      };
    }

    if (!cls?.start || !cls?.finish) {
      return {
        text: "Published",
        styles: "bg-blue-500/10 text-blue-600 border-blue-600/20",
      };
    }

    const now = new Date();
    const sDate = new Date(cls.start);
    const fDate = new Date(cls.finish);

    if (now < sDate) {
      return {
        text: "Upcoming",
        styles: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
      };
    }

    if (now > fDate) {
      return {
        text: "Concluded",
        styles: "bg-slate-500/10 text-slate-500 border-slate-500/20",
      };
    }

    return {
      text: "Published",
      styles:
        "bg-blue-500/10 text-blue-600 border-blue-600/20 status-pulse",
    };
  }

  const handleCreateCourse = (e) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    const code = courseCodeInput.trim().toUpperCase();

    if (!classNameInput.trim()) {
      setCreateError("Please enter a valid Course Name.");
      return;
    }

    if (!/^[A-Z]{2,5}[0-9]{3,5}$/.test(code)) {
      setCreateError("Course code must look like CSC9999, ENG1301, or SSC2400.");
      return;
    }

    if (startDate && finishDate && new Date(startDate) > new Date(finishDate)) {
      setCreateError("The finish date cannot occur prior to the start date.");
      return;
    }

    const codeExists = classes.some((c) => c.code?.toUpperCase() === code);

    if (codeExists) {
      setCreateError("This course code is already active in your system.");
      return;
    }

    try {
      const newClass = {
        id: "cls_" + Date.now(),
        name: classNameInput.trim(),
        code,
        description:
          descriptionInput.trim() || "No course description specified.",
        semester: semesterInput,
        start: startDate || null,
        finish: finishDate || null,
        isPublished: true,
      };

      if (setClasses) {
        setClasses([...classes, newClass]);
      }

      setCreateSuccess(`Course ${code} created successfully.`);

      setClassNameInput("");
      setCourseCodeInput("");
      setDescriptionInput("");
      setStartDate("");
      setFinishDate("");

      setTimeout(() => {
        setIsCreateOpen(false);
        setCreateSuccess("");
      }, 2500);
    } catch (err) {
      setCreateError("Failed to create course.");
    }
  };

  const totalClassesCount = classes.length;
  const totalAssignmentsCount = assignments.length;

  const pendingReviewsCount = submissions.filter((s) => {
    const status = String(s?.status || "").toLowerCase();
    return status === "submitted" || status === "late" || status === "reopened";
  }).length;

  function getClassEnrollments(cls) {
    return enrollments.filter((enrollment) => {
      const sameClassId = String(enrollment.classId) === String(cls.id);

      const sameClassCode =
        enrollment.classCode?.toUpperCase() === cls.code?.toUpperCase();

      return sameClassId || sameClassCode;
    });
  }

  function openCourseManager(cls) {
    setManagedClass(cls);
    setManagerMode("details");

    setManageCourseForm({
      name: cls.name || "",
      code: cls.code || "",
      description: cls.description || "",
      semester: cls.semester || "Fall 2026",
      start: cls.start || "",
      finish: cls.finish || "",
    });

    setStudentNameToAdd("");
    setStudentEmailToAdd("");
    setManagerError("");
    setManagerSuccess("");
  }

  function closeCourseManager() {
    setManagedClass(null);
    setManagerMode("details");
    setManagerError("");
    setManagerSuccess("");
  }

  function copyCourseCode(code) {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setManagerSuccess(`Course code ${code} copied.`);
      })
      .catch(() => {
        setManagerError("Could not copy the course code.");
      });
  }

  function toggleManagedCoursePublication() {
    if (!managedClass) return;

    setManagerError("");
    setManagerSuccess("");

    

    const updatedClass = {
      ...managedClass,
      isPublished: managedClass.isPublished === false,
    };

    const updatedClasses = classes.map((cls) =>
      String(cls.id) === String(managedClass.id) ? updatedClass : cls
    );

    const data = getPraxisData();

    savePraxisData({
      ...data,
      classes: updatedClasses,
    });

    if (typeof setClasses === "function") {
      setClasses(updatedClasses);
    }

    setManagedClass(updatedClass);

    setManagerSuccess(
      updatedClass.isPublished === false
        ? "Course unpublished. Students will no longer see or join this course, but existing course data is kept."
        : "Course published successfully. Students can see and join this course again."
    );
  }

  function removeManagedCourse() {
    if (!managedClass) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${managedClass.code}? This will also remove its enrollments, assignments, and related submissions from the mock workspace.`
    );

    if (!confirmed) return;

    const data = getPraxisData();

    const updatedClasses = classes.filter(
      (cls) => String(cls.id) !== String(managedClass.id)
    );

    const relatedAssignmentIds = (data.assignments || [])
      .filter((assignment) => {
        const sameClassId =
          assignment.classId &&
          String(assignment.classId) === String(managedClass.id);

        const sameClassCode =
          assignment.classCode?.toUpperCase() ===
          managedClass.code?.toUpperCase();

        return sameClassId || sameClassCode;
      })
      .map((assignment) => String(assignment.id));

    const updatedEnrollments = (data.enrollments || []).filter((enrollment) => {
      const sameClassId = String(enrollment.classId) === String(managedClass.id);

      const sameClassCode =
        enrollment.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      return !sameClassId && !sameClassCode;
    });

    const updatedAssignments = (data.assignments || []).filter((assignment) => {
      const sameClassId =
        assignment.classId &&
        String(assignment.classId) === String(managedClass.id);

      const sameClassCode =
        assignment.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      return !sameClassId && !sameClassCode;
    });

    const updatedSubmissions = (data.submissions || []).filter((submission) => {
      const belongsToDeletedAssignment = relatedAssignmentIds.includes(
        String(submission.assignmentId)
      );

      const sameClassCode =
        submission.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      return !belongsToDeletedAssignment && !sameClassCode;
    });

    savePraxisData({
      ...data,
      classes: updatedClasses,
      enrollments: updatedEnrollments,
      assignments: updatedAssignments,
      submissions: updatedSubmissions,
    });

    if (typeof setClasses === "function") {
      setClasses(updatedClasses);
    }

    if (typeof setAssignments === "function") {
      setAssignments(updatedAssignments);
    }

    if (typeof setSubmissions === "function") {
      setSubmissions(updatedSubmissions);
    }

    setEnrollments(updatedEnrollments);
    closeCourseManager();
  }

  function handleUpdateManagedCourse(e) {
    e.preventDefault();

    if (!managedClass) return;

    setManagerError("");
    setManagerSuccess("");

    const cleanName = manageCourseForm.name.trim();
    const cleanCode = manageCourseForm.code.trim().toUpperCase();

    if (!cleanName) {
      setManagerError("Course name is required.");
      return;
    }

    if (!/^[A-Z]{2,5}[0-9]{3,5}$/.test(cleanCode)) {
      setManagerError("Course code must look like CSC9999, ENG1301, or SSC2400.");
      return;
    }

    if (
      manageCourseForm.start &&
      manageCourseForm.finish &&
      new Date(manageCourseForm.start) > new Date(manageCourseForm.finish)
    ) {
      setManagerError("The finish date cannot occur before the start date.");
      return;
    }

    const duplicateCode = classes.some(
      (cls) =>
        String(cls.id) !== String(managedClass.id) &&
        cls.code?.toUpperCase() === cleanCode
    );

    if (duplicateCode) {
      setManagerError("Another course already uses this course code.");
      return;
    }

    const updatedClass = {
      ...managedClass,
      name: cleanName,
      code: cleanCode,
      description:
        manageCourseForm.description.trim() ||
        "No course description specified.",
      semester: manageCourseForm.semester,
      start: manageCourseForm.start || null,
      finish: manageCourseForm.finish || null,
      isPublished: managedClass.isPublished !== false,
    };

    const updatedClasses = classes.map((cls) =>
      String(cls.id) === String(managedClass.id) ? updatedClass : cls
    );

    setClasses(updatedClasses);
    setManagedClass(updatedClass);

    const data = getPraxisData();

    const updatedEnrollments = (data.enrollments || []).map((enrollment) => {
      const sameClassId = String(enrollment.classId) === String(managedClass.id);

      const sameClassCode =
        enrollment.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      if (!sameClassId && !sameClassCode) {
        return enrollment;
      }

      return {
        ...enrollment,
        classId: updatedClass.id,
        classCode: updatedClass.code,
        className: updatedClass.name,
      };
    });

    const updatedAssignments = (data.assignments || []).map((assignment) => {
      const sameClassId =
        assignment.classId &&
        String(assignment.classId) === String(managedClass.id);

      const sameClassCode =
        assignment.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      if (!sameClassId && !sameClassCode) {
        return assignment;
      }

      return {
        ...assignment,
        classId: updatedClass.id,
        classCode: updatedClass.code,
        className: updatedClass.name,
      };
    });

    const updatedSubmissions = (data.submissions || []).map((submission) => {
      const sameClassCode =
        submission.classCode?.toUpperCase() ===
        managedClass.code?.toUpperCase();

      if (!sameClassCode) {
        return submission;
      }

      return {
        ...submission,
        classCode: updatedClass.code,
        className: updatedClass.name,
      };
    });

    savePraxisData({
      ...data,
      classes: updatedClasses,
      enrollments: updatedEnrollments,
      assignments: updatedAssignments,
      submissions: updatedSubmissions,
    });

    if (typeof setAssignments === "function") {
      setAssignments(updatedAssignments);
    }

    if (typeof setSubmissions === "function") {
      setSubmissions(updatedSubmissions);
    }

    setEnrollments(updatedEnrollments);
    setManagerSuccess("Course updated successfully.");
  }

  function handleAddStudentToManagedCourse(e) {
    e.preventDefault();

    if (!managedClass) return;

    setManagerError("");
    setManagerSuccess("");

    const cleanName = studentNameToAdd.trim() || "Student";
    const cleanEmail = studentEmailToAdd.trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setManagerError("Please enter a valid student email.");
      return;
    }

    if (managedClass.isPublished === false) {
      setManagerError("Publish the course before adding students.");
      return;
    }

    const classEnrollments = getClassEnrollments(managedClass);

    const alreadyEnrolled = classEnrollments.some(
      (enrollment) => enrollment.studentEmail?.toLowerCase() === cleanEmail
    );

    if (alreadyEnrolled) {
      setManagerError("This student is already enrolled in this course.");
      return;
    }

    const newEnrollment = {
      id: "enr_" + Date.now(),
      studentName: cleanName,
      studentEmail: cleanEmail,
      classId: managedClass.id,
      classCode: managedClass.code,
      className: managedClass.name,
      enrolledAt: new Date().toISOString(),
    };

    const data = getPraxisData();
    const updatedEnrollments = [...(data.enrollments || []), newEnrollment];

    savePraxisData({
      ...data,
      enrollments: updatedEnrollments,
    });

    setEnrollments(updatedEnrollments);
    setStudentNameToAdd("");
    setStudentEmailToAdd("");
    setManagerSuccess(`${cleanEmail} added to ${managedClass.code}.`);
  }

  function removeStudentFromManagedCourse(enrollmentId) {
    if (!managedClass) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this student from the course?"
    );

    if (!confirmed) return;

    const data = getPraxisData();

    const updatedEnrollments = (data.enrollments || []).filter(
      (enrollment) => String(enrollment.id) !== String(enrollmentId)
    );

    savePraxisData({
      ...data,
      enrollments: updatedEnrollments,
    });

    setEnrollments(updatedEnrollments);
    setManagerSuccess("Student removed from the course.");
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8FAFC] flex font-sans antialiased text-slate-950 selection:bg-blue-100 selection:text-blue-900">
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
        @keyframes pulseBreathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(0.96); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .status-pulse {
          animation: pulseBreathe 2s infinite ease-in-out;
        }
        .glow-box-classes:hover {
          box-shadow: 0 12px 30px -10px rgba(37, 99, 235, 0.12), 0 0 0 1px rgba(37, 99, 235, 0.25);
          border-color: rgba(37, 99, 235, 0.35);
        }
        .glow-box-assignments:hover {
          box-shadow: 0 12px 30px -10px rgba(79, 70, 229, 0.12), 0 0 0 1px rgba(79, 70, 229, 0.25);
          border-color: rgba(79, 70, 229, 0.35);
        }
        .glow-box-reviews:hover {
          box-shadow: 0 12px 30px -10px rgba(14, 165, 233, 0.12), 0 0 0 1px rgba(14, 165, 233, 0.25);
          border-color: rgba(14, 165, 233, 0.35);
        }
      `}</style>

      <aside className="w-68 h-full bg-slate-950 text-slate-200 flex flex-col justify-between shrink-0 shadow-2xl relative z-20">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-6 border-b border-blue-900/30 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white border border-blue-400/20 shadow-md shadow-blue-900/30 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/praxis-logo.png"
                alt="Praxis logo"
                className="w-9 h-9 object-contain"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-none">
                <span className="text-blue-400">p</span>
                <span className="text-white">raxis</span>
              </h1>

              <p className="text-[9px] font-mono font-bold text-blue-300 uppercase tracking-wider mt-1.5">
                Teacher Dashboard
              </p>
            </div>
          </div>

          <div className="p-5 space-y-7 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-3 mb-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block">
                  Course Management
                </span>

                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-blue-300 hover:border-blue-400 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <SidebarButton
                active={activeTab === "overview"}
                icon={ClipboardList}
                label="Overview"
                onClick={() => setActiveTab("overview")}
              />

              <SidebarButton
                active={activeTab === "assignments"}
                icon={BookOpen}
                label="Assignments"
                badge={totalAssignmentsCount}
                onClick={() => setActiveTab("assignments")}
              />

              <SidebarButton
                active={activeTab === "submissions"}
                icon={FileText}
                label="Submissions"
                badge={submissions.length}
                badgeTone="blue"
                onClick={() => setActiveTab("submissions")}
              />

              <SidebarButton
                active={activeTab === "rubrics"}
                icon={Settings}
                label="Rubrics"
                onClick={() => setActiveTab("rubrics")}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block px-3 mb-2">
                Engagement
              </span>

              <SidebarButton
                active={activeTab === "communication"}
                icon={MessageSquare}
                label="Communication"
                onClick={() => setActiveTab("communication")}
              />
            </div>

            <div className="pt-5 border-t border-slate-800/80 space-y-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block px-3">
                Review Status
              </span>

              <div className="bg-slate-950/45 border border-slate-800/60 rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5 font-mono">
                    <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                    Platform Status
                  </span>

                  <span className="font-mono font-bold text-blue-600 text-[10px]">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1.5 border-t border-slate-800/50">
                  <span>Pending Reviews:</span>
                  <span className="font-bold text-white">
                    {pendingReviewsCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800/80 bg-slate-950/20 space-y-3">
          <div className="flex items-center gap-3 px-1 py-0.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-mono font-black text-white shadow-md shadow-blue-600/10">
              TR
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">
                Teacher Account
              </h4>

              <p className="text-[9px] font-mono text-slate-400 truncate">
                instructor@aui.ma
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-slate-400 hover:text-blue-700 hover:bg-blue-500/10 rounded-xl transition-all text-left cursor-pointer"
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
            onClick={() => setIsCreateOpen(true)}
            className="bg-slate-950 hover:bg-slate-800 text-white font-sans text-xs font-bold px-4 py-2 rounded-xl transition-all tracking-wide flex items-center gap-1.5 shadow-sm cursor-pointer hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            Add Course
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative blueprint-grid">
          <div className="max-w-7xl mx-auto h-full flex flex-col relative z-10 space-y-8">
            {activeTab === "overview" && (
              <OverviewPanel
                classes={classes}
                totalClassesCount={totalClassesCount}
                totalAssignmentsCount={totalAssignmentsCount}
                pendingReviewsCount={pendingReviewsCount}
                computeCourseStatus={computeCourseStatus}
                getClassEnrollments={getClassEnrollments}
                expandedClassId={expandedClassId}
                setExpandedClassId={setExpandedClassId}
                openCourseManager={openCourseManager}
                setIsCreateOpen={setIsCreateOpen}
              />
            )}

            {activeTab === "assignments" && (
              <TeacherAssignments
                onOpenSubmissions={() => setActiveTab("submissions")}
              />
            )}

            {activeTab === "submissions" && <TeacherSubmissions />}

            {activeTab === "rubrics" && <TeacherRubrics />}

            {activeTab === "communication" && <TeacherCommunication />}
          </div>
        </div>
      </main>

      {isCreateOpen && (
        <CreateCourseModal
          classNameInput={classNameInput}
          setClassNameInput={setClassNameInput}
          courseCodeInput={courseCodeInput}
          setCourseCodeInput={setCourseCodeInput}
          descriptionInput={descriptionInput}
          setDescriptionInput={setDescriptionInput}
          semesterInput={semesterInput}
          setSemesterInput={setSemesterInput}
          startDate={startDate}
          setStartDate={setStartDate}
          finishDate={finishDate}
          setFinishDate={setFinishDate}
          createError={createError}
          createSuccess={createSuccess}
          isCodeValid={isCodeValid}
          handleCreateCourse={handleCreateCourse}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {managedClass && (
        <CourseManagerModal
          managedClass={managedClass}
          managerMode={managerMode}
          setManagerMode={setManagerMode}
          manageCourseForm={manageCourseForm}
          setManageCourseForm={setManageCourseForm}
          studentNameToAdd={studentNameToAdd}
          setStudentNameToAdd={setStudentNameToAdd}
          studentEmailToAdd={studentEmailToAdd}
          setStudentEmailToAdd={setStudentEmailToAdd}
          managerError={managerError}
          managerSuccess={managerSuccess}
          closeCourseManager={closeCourseManager}
          copyCourseCode={copyCourseCode}
          toggleManagedCoursePublication={toggleManagedCoursePublication}
          removeManagedCourse={removeManagedCourse}
          handleUpdateManagedCourse={handleUpdateManagedCourse}
          handleAddStudentToManagedCourse={handleAddStudentToManagedCourse}
          removeStudentFromManagedCourse={removeStudentFromManagedCourse}
          computeCourseStatus={computeCourseStatus}
          getClassEnrollments={getClassEnrollments}
        />
      )}
    </div>
  );
}

function OverviewPanel({
  classes,
  totalClassesCount,
  totalAssignmentsCount,
  pendingReviewsCount,
  computeCourseStatus,
  getClassEnrollments,
  expandedClassId,
  setExpandedClassId,
  openCourseManager,
  setIsCreateOpen,
}) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up [animation-delay:100ms]">
        <MetricCard
          cardType="classes"
          icon={Layers}
          label="Active Courses"
          value={`${totalClassesCount} Courses`}
          description="Course access codes routing student portals."
          tone="blue"
        />

        <MetricCard
          cardType="assignments"
          icon={BookOpen}
          label="Assignments"
          value={`${totalAssignmentsCount} Assignments`}
          description="Writing assignments configured for your courses."
          tone="indigo"
        />

        <MetricCard
          cardType="reviews"
          icon={ShieldCheck}
          label="Pending Reviews"
          value={`${pendingReviewsCount} Submissions`}
          description="Student submissions waiting for your review."
          tone="sky"
        />
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 animate-fade-in-up [animation-delay:150ms]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-900">
              Courses & Access Codes
            </h3>

            <p className="text-xs text-slate-400 font-medium">
              Manage course details, access codes, publication status, and
              student access.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-all self-start lg:self-center"
          >
            <Plus className="w-4 h-4" />
            Add Course
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center text-xs text-slate-400 font-mono">
            No courses yet. Click "Add Course" to create your first course.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {classes.map((cls) => {
              const status = computeCourseStatus(cls);
              const classEnrollments = getClassEnrollments(cls);
              const isRosterOpen = expandedClassId === cls.id;

              return (
                <div
                  key={cls.id}
                  className="p-5 bg-[#F8FAFC] border border-slate-200/80 rounded-2xl flex flex-col justify-between space-y-4 transition-all hover:bg-white hover:shadow-md group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                            {cls.semester}
                          </span>

                          <span
                            className={`text-[9px] font-mono border px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${status.styles}`}
                          >
                            {status.text}
                          </span>
                        </div>

                        <h5 className="text-xs font-black text-slate-900 tracking-wide uppercase font-sans truncate mt-1">
                          {cls.name}
                        </h5>
                      </div>

                      <span className="font-mono text-xs font-black bg-blue-600/10 text-blue-700 px-2 py-1 rounded border border-blue-600/20 shadow-inner shrink-0">
                        {cls.code}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 font-medium line-clamp-2 leading-relaxed">
                      {cls.description}
                    </p>

                    {(cls.start || cls.finish) && (
                      <div className="grid grid-cols-2 gap-1 bg-white border border-slate-200/40 p-2 rounded-xl text-[10px] font-mono text-slate-500">
                        <div>
                          <span className="text-slate-400 text-[9px] block uppercase font-bold">
                            Starts
                          </span>

                          <span className="font-semibold text-slate-700 truncate block">
                            {cls.start || "Unset"}
                          </span>
                        </div>

                        <div className="border-l border-slate-200/60 pl-2">
                          <span className="text-slate-400 text-[9px] block uppercase font-bold">
                            Ends
                          </span>

                          <span className="font-semibold text-slate-700 truncate block">
                            {cls.finish || "Unset"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-200/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openCourseManager(cls)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-950 border border-[#0B1320] rounded-xl px-3 py-2 text-[10px] font-mono font-bold text-white hover:bg-slate-800 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Manage Course
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedClassId(isRosterOpen ? null : cls.id)
                        }
                        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-mono font-bold text-slate-600 hover:border-blue-600/40 hover:text-blue-600 transition-all"
                      >
                        <span>Students</span>
                        <span>{isRosterOpen ? "Hide" : "Show"}</span>
                      </button>
                    </div>

                    {isRosterOpen && (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                        {classEnrollments.length === 0 ? (
                          <p className="text-[10px] text-slate-400 font-mono">
                            No students enrolled yet.
                          </p>
                        ) : (
                          classEnrollments.map((enrollment) => (
                            <div
                              key={enrollment.id}
                              className="flex items-center justify-between gap-2 bg-[#F8FAFC] border border-slate-100 rounded-lg px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-800 truncate">
                                  {enrollment.studentName || "Student"}
                                </p>

                                <p className="text-[9px] font-mono text-slate-400 truncate">
                                  {enrollment.studentEmail}
                                </p>
                              </div>

                              <span className="text-[8px] font-mono font-bold uppercase bg-blue-600/10 text-blue-600 px-2 py-0.5 rounded">
                                Enrolled
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCourseModal({
  classNameInput,
  setClassNameInput,
  courseCodeInput,
  setCourseCodeInput,
  descriptionInput,
  setDescriptionInput,
  semesterInput,
  setSemesterInput,
  startDate,
  setStartDate,
  finishDate,
  setFinishDate,
  createError,
  createSuccess,
  isCodeValid,
  handleCreateCourse,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
      />

      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl p-7 relative z-10 shadow-2xl flex flex-col gap-5 font-sans animate-fade-in-up my-8">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-blue-600 font-mono font-bold text-[10px] tracking-widest uppercase bg-blue-600/5 px-2 py-0.5 rounded border border-blue-600/10">
              <Sparkle className="w-3 h-3 text-blue-600 fill-blue-600" />
              Course Setup
            </div>

            <h3 className="font-serif text-xl font-black text-slate-900 mt-2">
              Create New Course
            </h3>

            <p className="text-xs text-slate-400 font-medium">
              Add course details, access code, schedule dates, and a short
              description.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block px-1">
              Course Name
            </label>

            <input
              type="text"
              required
              value={classNameInput}
              onChange={(e) => setClassNameInput(e.target.value)}
              placeholder="e.g. MOROCCAN STUDIES & ARCHITECTURE"
              className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 uppercase font-mono rounded-xl px-4 py-3 text-xs focus:outline-none transition-all shadow-inner"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Course Code / Access Code
                </label>

                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isCodeValid
                      ? "bg-blue-600/10 text-blue-600"
                      : "bg-blue-500/10 text-blue-700"
                  }`}
                >
                  e.g. CSC9999
                </span>
              </div>

              <input
                value={courseCodeInput}
                onChange={(e) =>
                  setCourseCodeInput(e.target.value.toUpperCase())
                }
                placeholder="CSC9999"
                className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 uppercase font-mono rounded-xl px-4 py-3.5 text-xs focus:outline-none transition-all shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block px-1">
                Academic Semester
              </label>

              <select
                value={semesterInput}
                onChange={(e) => setSemesterInput(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:border-slate-400 cursor-pointer shadow-inner font-mono font-bold uppercase"
              >
                <option value="Fall 2026">Fall 2026</option>
                <option value="Spring 2027">Spring 2027</option>
                <option value="Summer 2027">Summer 2027</option>
                <option value="Fall 2027">Fall 2027</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8FAFC] border border-slate-200/60 p-4 rounded-2xl">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Course Start Date
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 font-mono text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Course End Date
              </label>

              <input
                type="date"
                value={finishDate}
                onChange={(e) => setFinishDate(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 font-mono text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block px-1">
              Course Description
            </label>

            <textarea
              rows={2}
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="Add a short course description, writing guidelines, or important notes..."
              className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none transition-all resize-none shadow-inner"
            />
          </div>

          {createError && (
            <div className="p-3 bg-red-500/5 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-sans">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-red-600" />
              <span className="font-semibold">{createError}</span>
            </div>
          )}

          {createSuccess && (
            <div className="p-3 bg-blue-500/5 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-600 font-mono">
              <CheckSquare className="w-4.5 h-4.5 shrink-0" />
              <span>{createSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!isCodeValid || !classNameInput}
            className={`w-full font-sans text-xs font-bold py-3.5 rounded-xl shadow-md transition-all ${
              isCodeValid && classNameInput
                ? "bg-slate-950 text-white hover:bg-slate-800 hover:scale-[1.01] cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            Create Course
          </button>
        </form>
      </div>
    </div>
  );
}

function CourseManagerModal({
  managedClass,
  managerMode,
  setManagerMode,
  manageCourseForm,
  setManageCourseForm,
  studentNameToAdd,
  setStudentNameToAdd,
  studentEmailToAdd,
  setStudentEmailToAdd,
  managerError,
  managerSuccess,
  closeCourseManager,
  copyCourseCode,
  toggleManagedCoursePublication,
  removeManagedCourse,
  handleUpdateManagedCourse,
  handleAddStudentToManagedCourse,
  removeStudentFromManagedCourse,
  computeCourseStatus,
  getClassEnrollments,
}) {
  const publicationTooltip =
    managedClass.isPublished === false
      ? "Publishing this course makes it visible again to students and allows students to join using the access code."
      : "Unpublishing hides this course from students and prevents new joins. Existing course data, assignments, submissions, and enrolled students are kept.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        onClick={closeCourseManager}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
      />

      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl relative z-10 shadow-2xl font-sans animate-fade-in-up my-8 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-blue-600 font-mono font-bold text-[10px] tracking-widest uppercase bg-blue-600/5 px-2 py-0.5 rounded border border-blue-600/10">
              <Settings className="w-3 h-3" />
              Course Manager
            </div>

            <h3 className="font-serif text-2xl font-black text-slate-900 mt-2">
              {managedClass.name}
            </h3>

            <p className="text-xs text-slate-400 font-mono mt-1">
              {managedClass.code} · {managedClass.semester || "Course"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copyCourseCode(managedClass.code)}
              className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-white transition-all"
            >
              <Copy className="w-4 h-4" />
              Copy Code
            </button>

            <div className="relative group">
              <button
  type="button"
  onClick={toggleManagedCoursePublication}
  className={`inline-flex items-center gap-2 border text-xs font-bold px-4 py-2.5 rounded-xl transition-all ${
                  managedClass.isPublished === false
                    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-white"
                }`}
              >
                {managedClass.isPublished === false ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}

                {managedClass.isPublished === false
                  ? "Publish Course"
                  : "Unpublish Course"}
              </button>

              <div className="pointer-events-none absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-600 shadow-xl opacity-0 translate-y-1 transition-all group-hover:opacity-100 group-hover:translate-y-0 z-30">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>{publicationTooltip}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={removeManagedCourse}
              className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Remove Course
            </button>

            <button
              type="button"
              onClick={closeCourseManager}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-0">
          <div className="p-6 border-r border-slate-100">
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setManagerMode("details")}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  managerMode === "details"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Course Details
              </button>

              <button
                type="button"
                onClick={() => setManagerMode("students")}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  managerMode === "students"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Students
              </button>
            </div>

            {managerMode === "details" ? (
              <form onSubmit={handleUpdateManagedCourse} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Course Name
                  </label>

                  <input
                    value={manageCourseForm.name}
                    onChange={(e) =>
                      setManageCourseForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 uppercase font-mono rounded-xl px-4 py-3 text-xs focus:outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Course Code
                    </label>

                    <input
                      value={manageCourseForm.code}
                      onChange={(e) =>
                        setManageCourseForm((prev) => ({
                          ...prev,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 uppercase font-mono rounded-xl px-4 py-3 text-xs focus:outline-none transition-all shadow-inner"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Semester
                    </label>

                    <select
                      value={manageCourseForm.semester}
                      onChange={(e) =>
                        setManageCourseForm((prev) => ({
                          ...prev,
                          semester: e.target.value,
                        }))
                      }
                      className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:border-slate-400 cursor-pointer shadow-inner font-mono font-bold uppercase"
                    >
                      <option value="Fall 2026">Fall 2026</option>
                      <option value="Spring 2027">Spring 2027</option>
                      <option value="Summer 2027">Summer 2027</option>
                      <option value="Fall 2027">Fall 2027</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8FAFC] border border-slate-200/60 p-4 rounded-2xl">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                      Course Start Date
                    </label>

                    <input
                      type="date"
                      value={manageCourseForm.start}
                      onChange={(e) =>
                        setManageCourseForm((prev) => ({
                          ...prev,
                          start: e.target.value,
                        }))
                      }
                      className="w-full bg-white border border-slate-200 text-slate-900 font-mono text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                      Course End Date
                    </label>

                    <input
                      type="date"
                      value={manageCourseForm.finish}
                      onChange={(e) =>
                        setManageCourseForm((prev) => ({
                          ...prev,
                          finish: e.target.value,
                        }))
                      }
                      className="w-full bg-white border border-slate-200 text-slate-900 font-mono text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Course Description
                  </label>

                  <textarea
                    rows={3}
                    value={manageCourseForm.description}
                    onChange={(e) =>
                      setManageCourseForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full bg-[#F8FAFC] border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none transition-all resize-none shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-950 text-white hover:bg-slate-800 font-sans text-xs font-bold py-3.5 rounded-xl shadow-md transition-all hover:scale-[1.01]"
                >
                  Save Course Changes
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <form
                  onSubmit={handleAddStudentToManagedCourse}
                  className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-blue-600" />

                    <h4 className="text-sm font-bold text-slate-900">
                      Add Student Manually
                    </h4>
                  </div>

                  <input
                    value={studentNameToAdd}
                    onChange={(e) => setStudentNameToAdd(e.target.value)}
                    placeholder="Student name"
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-slate-400"
                  />

                  <input
                    value={studentEmailToAdd}
                    onChange={(e) => setStudentEmailToAdd(e.target.value)}
                    placeholder="student@aui.ma"
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-slate-400"
                  />

                  <button
                    type="submit"
                    className="w-full bg-slate-900 text-white text-xs font-bold rounded-xl py-3 hover:bg-slate-800 transition-all"
                  >
                    Add Student to Course
                  </button>
                </form>

                <div className="space-y-2">
                  {getClassEnrollments(managedClass).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                      No students enrolled in this course yet.
                    </div>
                  ) : (
                    getClassEnrollments(managedClass).map((enrollment) => (
                      <div
                        key={enrollment.id}
                        className="flex items-center justify-between gap-3 bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {enrollment.studentName || "Student"}
                          </p>

                          <p className="text-[10px] font-mono text-slate-400 truncate">
                            {enrollment.studentEmail}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeStudentFromManagedCourse(enrollment.id)
                          }
                          className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-3 py-2 rounded-xl hover:bg-red-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#F8FAFC] p-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Publication Status
              </p>

              <p
                className={`inline-flex mt-2 text-[10px] font-mono font-bold uppercase border px-2 py-1 rounded ${
                  computeCourseStatus(managedClass).styles
                }`}
              >
                {computeCourseStatus(managedClass).text}
              </p>

              <p className="text-xs text-slate-400 mt-2">
                Unpublished courses are hidden from students and cannot be
                joined with the access code. Existing data is kept.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Access Code
              </p>

              <p className="text-2xl font-mono font-black text-blue-700 mt-1">
                {managedClass.code}
              </p>

              <p className="text-xs text-slate-400 mt-2">
                Students can use this code to join the course from the student
                dashboard when the course is published.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />

                <div>
                  <p className="text-xs font-bold text-blue-900">
                    Publish / Unpublish behavior
                  </p>

                  <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                    Publishing makes the course visible to students.
                    Unpublishing hides it from students while keeping course
                    records, assignments, submissions, and enrolled students.
                  </p>
                </div>
              </div>
            </div>

            {managerError && (
              <div className="p-3 bg-red-500/5 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{managerError}</span>
              </div>
            )}

            {managerSuccess && (
              <div className="p-3 bg-blue-500/5 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-600">
                <CheckSquare className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{managerSuccess}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarButton({
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
              ? badgeTone === "blue"
                ? "bg-blue-500 text-white"
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

function MetricCard({ icon: Icon, label, value, description, tone, cardType }) {
  const toneStyles = {
    blue: {
      icon: "bg-blue-50 border-blue-100 text-blue-700",
      label: "text-blue-700 bg-blue-50 border-blue-100",
    },
    indigo: {
      icon: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600",
      label: "text-indigo-700 bg-indigo-500/5 border-indigo-500/10",
    },
    sky: {
      icon: "bg-sky-50 border-sky-100 text-sky-700",
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
          className={`text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border inline-block ${styles.label}`}
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