import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Mail,
  MessageSquare,
  Save,
  Search,
  Send,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { useTeacherWorkspace } from "../../hooks/useTeacherWorkspace";
import {
  getPraxisData,
} from "../../services/praxisMockStore";
import {
  deleteCourseMessage,
  getCourseMessages,
  saveCourseMessageDraft,
  sendCourseMessage,
} from "../../services/courseApi";
import { queryClient, queryKeys } from "../../queryClient";

function normalizeStoredMessage(row = {}) {
  const emails = Array.isArray(row.recipient_emails) ? row.recipient_emails : [];
  return {
    id: row.id,
    status:
      row.status === "draft"
        ? "Draft"
        : row.status === "failed"
          ? "Email Could Not Be Sent"
          : "Email Sent",
    channel: row.recipient_mode === "individual" ? "Direct Email" : "Course Email",
    courseId: row.class_id,
    courseCode: row.classes?.invite_code || "",
    courseName: row.classes?.name || "Course",
    recipientMode: row.recipient_mode,
    recipientCount: emails.length,
    deliveredCount: row.delivered_count || 0,
    failedCount: row.failed_count || 0,
    recipientEmails: emails,
    recipientStudentEmail: row.recipient_mode === "individual" ? emails[0] || "" : "",
    subject: row.subject || "",
    body: row.body || "",
    createdAt: row.sent_at || row.created_at,
    updatedAt: row.updated_at,
  };
}

const MESSAGE_TEMPLATES = [
  {
    id: "deadline-reminder",
    title: "Assignment Deadline Reminder",
    subject: "Reminder: Upcoming assignment deadline",
    body:
      "Dear students,\n\nThis is a reminder that your assignment is due soon. Please make sure to review the instructions carefully and submit your work before the deadline.\n\nBest regards,",
  },
  {
    id: "feedback-available",
    title: "Feedback Available",
    subject: "Feedback is available for your submission",
    body:
      "Dear students,\n\nFeedback is now available for your recent submission. Please review the comments carefully and use them to improve your next draft or assignment.\n\nBest regards,",
  },
  {
    id: "welcome-course",
    title: "Welcome Message",
    subject: "Welcome to the course",
    body:
      "Dear students,\n\nWelcome to the course. Please make sure you can access Praxis and review the course assignments and expectations.\n\nBest regards,",
  },
  {
    id: "missing-submission",
    title: "Missing Submission Reminder",
    subject: "Missing assignment submission",
    body:
      "Dear students,\n\nThis is a reminder to check your assignment submission status. If you have not submitted your work yet, please do so as soon as possible.\n\nBest regards,",
  },
];

function formatDateTime(value) {
  if (!value) return "Not available";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function uniqueEmails(emails = []) {
  return Array.from(
    new Set(
      emails
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export default function TeacherCommunication() {
  const { classes = [] } = useTeacherWorkspace();

  const activeCourses = useMemo(
    () => classes.filter((course) => course?.archived !== true),
    [classes]
  );

  const [data, setData] = useState(() => getPraxisData());
  const { data: storedMessageRows = [] } = useQuery({
    queryKey: queryKeys.courseMessages,
    queryFn: getCourseMessages,
    staleTime: 30_000,
  });
  const [sessionMessages, setSessionMessages] = useState([]);
  const [activeView, setActiveView] = useState("compose");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [recipientMode, setRecipientMode] = useState("all");
  const [selectedStudentEmail, setSelectedStudentEmail] = useState("");

  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [showBccList, setShowBccList] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [systemMessage, setSystemMessage] = useState("");
  const [systemError, setSystemError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState("");
  const [detailMessage, setDetailMessage] = useState(null);

  useEffect(() => {
    if (!systemMessage) return undefined;

    const timer = window.setTimeout(() => {
      setSystemMessage("");
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [systemMessage]);

  useEffect(() => {
    const latestData = getPraxisData();
    setData(latestData);

    const selectedCourseStillActive = activeCourses.some(
      (course) => String(course.id) === String(selectedCourseId)
    );

    if (!selectedCourseStillActive) {
      setSelectedCourseId(
        activeCourses.length === 1 ? String(activeCourses[0].id) : ""
      );
    }
  }, [activeCourses, selectedCourseId]);

  const enrollments = useMemo(
    () => data.enrollments || [],
    [data.enrollments]
  );
  const communicationMessages = useMemo(() => {
    const stored = storedMessageRows.map(normalizeStoredMessage);
    const storedIds = new Set(stored.map((message) => String(message.id)));
    return [
      ...sessionMessages.filter((message) => !storedIds.has(String(message.id))),
      ...stored,
    ];
  }, [sessionMessages, storedMessageRows]);

  const selectedCourse = useMemo(() => {
    return (
      activeCourses.find(
        (course) => String(course.id) === String(selectedCourseId)
      ) || null
    );
  }, [activeCourses, selectedCourseId]);

  const courseEnrollments = useMemo(() => {
    if (!selectedCourse) return [];

    return enrollments.filter((enrollment) => {
      const sameClassId =
        enrollment.classId &&
        selectedCourse.id &&
        String(enrollment.classId) === String(selectedCourse.id);

      const sameClassCode =
        enrollment.classCode?.toUpperCase() ===
        selectedCourse.code?.toUpperCase();

      return sameClassId || sameClassCode;
    });
  }, [enrollments, selectedCourse]);

  const selectableStudents = useMemo(() => {
    const studentsByEmail = new Map();

    courseEnrollments.forEach((enrollment) => {
      const email = String(enrollment?.studentEmail || "")
        .trim()
        .toLowerCase();

      if (!email || studentsByEmail.has(email)) return;

      studentsByEmail.set(email, {
        id: enrollment.id || email,
        studentId: enrollment.studentId || enrollment.student_id || "",
        studentName: enrollment.studentName || "Student",
        studentEmail: email,
      });
    });

    return Array.from(studentsByEmail.values()).sort((first, second) =>
      String(first.studentName || first.studentEmail).localeCompare(
        String(second.studentName || second.studentEmail)
      )
    );
  }, [courseEnrollments]);

  const selectedStudent = useMemo(() => {
    return (
      selectableStudents.find(
        (student) =>
          String(student.studentEmail) === String(selectedStudentEmail)
      ) || null
    );
  }, [selectableStudents, selectedStudentEmail]);

  const bccEmails = useMemo(() => {
    return uniqueEmails(
      courseEnrollments.map((enrollment) => enrollment.studentEmail)
    );
  }, [courseEnrollments]);

  const recipientEmails = useMemo(() => {
    if (recipientMode === "individual") {
      return selectedStudent?.studentEmail
        ? [selectedStudent.studentEmail]
        : [];
    }

    return bccEmails;
  }, [bccEmails, recipientMode, selectedStudent]);

  useEffect(() => {
    if (recipientMode !== "individual") return;

    const selectedStudentStillEnrolled = selectableStudents.some(
      (student) =>
        String(student.studentEmail) === String(selectedStudentEmail)
    );

    if (!selectedStudentStillEnrolled) {
      setSelectedStudentEmail("");
    }
  }, [recipientMode, selectableStudents, selectedStudentEmail]);

  const filteredHistory = useMemo(() => {
    const query = historySearch.toLowerCase().trim();

    return communicationMessages.filter((message) => {
      const matchesSearch =
        !query ||
        message.subject?.toLowerCase().includes(query) ||
        message.body?.toLowerCase().includes(query) ||
        message.courseCode?.toLowerCase().includes(query) ||
        message.courseName?.toLowerCase().includes(query) ||
        message.recipientStudentName?.toLowerCase().includes(query) ||
        message.recipientStudentEmail?.toLowerCase().includes(query);

      return matchesSearch;
    });
  }, [communicationMessages, historySearch]);

  function persistCommunicationMessage(message, successText, replaceId = "") {
    setSessionMessages((current) => [
      message,
      ...current.filter(
        (entry) => !replaceId || String(entry.id) !== String(replaceId)
      ),
    ]);

    setSystemMessage(successText || "");
    setSystemError("");
    queryClient.invalidateQueries({ queryKey: queryKeys.courseMessages });
  }

  function resetComposer() {
    setSubject("");
    setMessageBody("");
    setShowBccList(false);
    setEditingDraftId("");
  }

  function openHistoryMessage(message) {
    if (message.status !== "Draft") {
      setDetailMessage(message);
      return;
    }

    const draftCourse = activeCourses.find(
      (course) =>
        String(course.id) === String(message.courseId) ||
        (course.code &&
          String(course.code).toUpperCase() ===
            String(message.courseCode || "").toUpperCase())
    );

    setSelectedCourseId(draftCourse ? String(draftCourse.id) : "");
    setRecipientMode(message.recipientMode === "individual" ? "individual" : "all");
    setSelectedStudentEmail(
      message.recipientMode === "individual"
        ? message.recipientStudentEmail || message.recipientEmails?.[0] || ""
        : ""
    );
    setSubject(message.subject || "");
    setMessageBody(message.body || "");
    setEditingDraftId(String(message.id));
    setSystemMessage("");
    setSystemError("");
    setActiveView("compose");
  }

  function validateComposer() {
    setSystemMessage("");
    setSystemError("");

    if (!selectedCourse) {
      setSystemError("Please select a course first.");
      return false;
    }

    if (recipientMode === "individual" && !selectedStudent) {
      setSystemError("Please select an individual student.");
      return false;
    }

    if (recipientMode === "all" && bccEmails.length === 0) {
      setSystemError("No enrolled student emails found for this course.");
      return false;
    }

    if (!subject.trim()) {
      setSystemError("Please enter an email subject.");
      return false;
    }

    if (!messageBody.trim()) {
      setSystemError("Please enter a message.");
      return false;
    }

    return true;
  }

  async function handlePrepareSend(e) {
    e.preventDefault();

    if (!validateComposer() || isSending) return;

    const isIndividualRecipient = recipientMode === "individual";
    const backendCourseId = selectedCourse.backendId || selectedCourse.id;
    const requestId = globalThis.crypto?.randomUUID?.() ||
      `message_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    setIsSending(true);

    try {
      const delivery = await sendCourseMessage(backendCourseId, {
        recipientMode,
        studentId: isIndividualRecipient ? selectedStudent?.studentId : "",
        subject: subject.trim(),
        body: messageBody.trim(),
        requestId,
      });

      const message = {
        id: delivery.message?.id || `comm_${requestId}`,
        type: "email",
        channel: isIndividualRecipient ? "Direct Email" : "Course Email",
        status:
          delivery.failedCount > 0 && delivery.deliveredCount === 0
            ? "Email Could Not Be Sent"
            : "Email Sent",
        frontendOnly: false,

        courseId: selectedCourse.id,
        backendCourseId,
        courseCode: selectedCourse.code,
        courseName: selectedCourse.name,

        recipientMode,
        recipientCount: delivery.recipientCount,
        deliveredCount: delivery.deliveredCount,
        failedCount: delivery.failedCount,
        recipientEmails,
        bccEmails: isIndividualRecipient ? [] : recipientEmails,
        toEmails: isIndividualRecipient ? recipientEmails : [],
        recipientStudentName: isIndividualRecipient
          ? selectedStudent?.studentName || "Student"
          : "",
        recipientStudentEmail: isIndividualRecipient
          ? selectedStudent?.studentEmail || ""
          : "",

        subject: subject.trim(),
        body: messageBody.trim(),

        createdAt: delivery.sentAt || delivery.queuedAt || new Date().toISOString(),
      };

      persistCommunicationMessage(
        message,
        delivery.failedCount > 0 && delivery.deliveredCount === 0
          ? "Email could not be sent. Please try again."
          : delivery.failedCount > 0
          ? `Email sent to ${delivery.deliveredCount} of ${delivery.recipientCount} students.`
          : isIndividualRecipient
          ? `Email sent to ${selectedStudent?.studentName || "the selected student"}.`
          : `Email sent to ${delivery.recipientCount} student${delivery.recipientCount === 1 ? "" : "s"}.`,
        editingDraftId
      );

      resetComposer();
      setActiveView("history");
    } catch (error) {
      setSystemMessage("");
      setSystemError(error?.message || "The email could not be sent.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleSaveDraft() {
    setSystemMessage("");
    setSystemError("");

    if (!selectedCourse) {
      setSystemError("Please select a course first.");
      return;
    }

    if (!subject.trim() && !messageBody.trim()) {
      setSystemError("Add a subject or message before saving a draft.");
      return;
    }

    if (recipientMode === "individual" && !selectedStudent) {
      setSystemError("Please select an individual student before saving.");
      return;
    }

    const isIndividualRecipient = recipientMode === "individual";

    const message = {
      id: editingDraftId || `draft_${Date.now()}`,
      type: "email",
      channel: isIndividualRecipient ? "Direct Email" : "BCC Email",
      status: "Draft",
      frontendOnly: true,

      courseId: selectedCourse.id,
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,

      recipientMode,
      recipientCount: recipientEmails.length,
      recipientEmails,
      bccEmails: isIndividualRecipient ? [] : recipientEmails,
      toEmails: isIndividualRecipient ? recipientEmails : [],
      recipientStudentName: isIndividualRecipient
        ? selectedStudent?.studentName || "Student"
        : "",
      recipientStudentEmail: isIndividualRecipient
        ? selectedStudent?.studentEmail || ""
        : "",

      subject: subject.trim() || "Untitled draft",
      body: messageBody.trim(),

      createdAt:
        communicationMessages.find(
          (entry) => String(entry.id) === String(editingDraftId)
        )?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const stored = await saveCourseMessageDraft({
        id: editingDraftId || undefined,
        classId: selectedCourse.backendId || selectedCourse.id,
        recipientMode,
        studentId: isIndividualRecipient ? selectedStudent?.studentId : null,
        recipientEmails,
        subject: message.subject,
        body: message.body,
      });
      persistCommunicationMessage(normalizeStoredMessage({
        ...stored,
        classes: { name: selectedCourse.name, invite_code: selectedCourse.code },
      }), "", editingDraftId);
      resetComposer();
      setActiveView("history");
    } catch (error) {
      setSystemError(error?.message || "The message draft could not be saved.");
    }
  }

  async function handleDeleteMessage(messageId) {
    const confirmed = window.confirm(
      "Delete this message record from Supabase?"
    );

    if (!confirmed) return;

    try {
      await deleteCourseMessage(messageId);
      setSessionMessages((current) =>
        current.filter((message) => String(message.id) !== String(messageId))
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.courseMessages });
      setSystemMessage("");
      setSystemError("");
    } catch (error) {
      setSystemError(error?.message || "The message could not be deleted.");
    }
  }

  function applyTemplate(template) {
    setSubject(template.subject);
    setMessageBody(template.body);
    setActiveView("compose");
    setSystemMessage("");
    setSystemError("");
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
              <MessageSquare className="w-3 h-3" />
              Communication
            </div>

            <h2 className="text-2xl font-serif font-black text-slate-950">
              Messages
            </h2>

            <p className="text-xs text-slate-500 font-medium max-w-2xl leading-relaxed">
              Communicate with students and manage course announcements.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <CommunicationTab
              active={activeView === "compose"}
              label="Compose"
              icon={Mail}
              onClick={() => setActiveView("compose")}
            />

            <CommunicationTab
              active={activeView === "history"}
              label="History"
              icon={Clock}
              onClick={() => setActiveView("history")}
            />

            
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          <SummaryBox
            label="Active Courses"
            value={activeCourses.length}
            icon={Users}
          />

          <SummaryBox
            label="Message Records"
            value={communicationMessages.length}
            icon={Clock}
          />
        </div>
      </div>

      {(systemMessage || systemError) && (
        <div
          className={`rounded-2xl border p-4 flex items-start gap-3 ${
            systemError
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-blue-50 border-blue-100 text-blue-800"
          }`}
        >
          {systemError ? (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          )}

          <p className="text-xs font-bold leading-relaxed">
            {systemError || systemMessage}
          </p>
        </div>
      )}

      {activeView === "compose" && (
        <form onSubmit={handlePrepareSend} className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_0.9fr] gap-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-950">
                  {editingDraftId ? "Edit Draft" : "Compose Email"}
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Send privately to all enrolled students or choose one
                  individual student.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,0.75fr)_1fr] gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                    Course
                  </label>

                  <select
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setSelectedStudentEmail("");
                      setSystemError("");
                      setSystemMessage("");
                    }}
                    className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">
                      {activeCourses.length === 0
                        ? "No active courses"
                        : "Select a course"}
                    </option>

                    {activeCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code}  -  {course.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                    Recipients
                  </label>

                  <select
                    value={recipientMode}
                    onChange={(e) => {
                      const nextMode = e.target.value;
                      setRecipientMode(nextMode);

                      if (nextMode !== "individual") {
                        setSelectedStudentEmail("");
                      }

                      setSystemError("");
                      setSystemMessage("");
                    }}
                    className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="all">All enrolled students</option>
                    <option value="individual">Individual student</option>
                  </select>
                </div>

                {recipientMode === "individual" && (
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                      Student
                    </label>

                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <select
                        value={selectedStudentEmail}
                        onChange={(e) => {
                          setSelectedStudentEmail(e.target.value);
                          setSystemError("");
                          setSystemMessage("");
                        }}
                        disabled={!selectedCourse || selectableStudents.length === 0}
                        className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">
                          {!selectedCourse
                            ? "Select a course first"
                            : selectableStudents.length === 0
                            ? "No enrolled students"
                            : "Select a student"}
                        </option>

                        {selectableStudents.map((student) => (
                          <option
                            key={student.id || student.studentEmail}
                            value={student.studentEmail}
                          >
                            {student.studentName}  -  {student.studentEmail}
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="text-[10px] text-slate-400">
                      The email will be addressed only to the selected student.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                  Email Subject
                </label>

                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Example: Reminder about Essay 1"
                  className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                  Message
                </label>

                <textarea
                  rows={10}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Write the message students will receive..."
                  className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none leading-relaxed"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-[#F8FAFC] transition-all text-xs font-bold"
                >
                  <Save className="w-4 h-4" />
                  {editingDraftId ? "Update Draft" : "Save Draft"}
                </button>

                <button
                  type="submit"
                  disabled={isSending}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20"
                >
                  <Send className="w-4 h-4" />
                  {isSending
                    ? "Sending Email..."
                    : recipientMode === "individual" && selectedStudent
                    ? `Send Email to ${
                        selectedStudent.studentName || "Student"
                      }`
                    : `Send Email to ${recipientEmails.length} Student${
                        recipientEmails.length === 1 ? "" : "s"
                      }`}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  {recipientMode === "individual" ? (
                    <UserRound className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Users className="w-4 h-4 text-blue-600" />
                  )}

                  <h3 className="font-serif text-sm font-bold text-slate-950">
                    {recipientMode === "individual"
                      ? "Selected Student"
                      : "Course Recipients"}
                  </h3>
                </div>

                {recipientMode === "individual" ? (
                  <>
                    <p className="mt-4 truncate font-serif text-xl font-black text-slate-950">
                      {selectedStudent?.studentName || "No student selected"}
                    </p>

                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                      {selectedStudent?.studentEmail ||
                        "Choose an enrolled student from the form."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-serif font-black text-slate-950 mt-4">
                      {recipientEmails.length}
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      enrolled student
                      {recipientEmails.length === 1 ? "" : "s"} in{" "}
                      <span className="font-bold text-slate-800">
                        {selectedCourse?.code || "No course"}
                      </span>
                    </p>
                  </>
                )}

                <button
                  type="button"
                  disabled={recipientEmails.length === 0}
                  onClick={() => setShowBccList((prev) => !prev)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showBccList ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {showBccList
                    ? "Hide Recipient"
                    : recipientMode === "individual"
                    ? "View Recipient"
                    : "Preview Recipient List"}
                </button>
              </div>

              {showBccList && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm max-h-72 overflow-y-auto space-y-2">
                  {recipientEmails.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No recipient selected.
                    </p>
                  ) : (
                    recipientEmails.map((email) => (
                      <div
                        key={email}
                        className="rounded-lg bg-[#F8FAFC] border border-slate-100 px-3 py-2 text-[10px] font-mono text-slate-600 truncate"
                      >
                        {email}
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>
          </div>
        </form>
      )}

      {activeView === "history" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-[#F8FAFC] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-slate-950">
                Communication History
              </h3>

              <p className="text-xs text-slate-500 mt-1">
                History of sent emails and locally saved drafts.
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center bg-white">
              <MessageSquare className="w-9 h-9 mx-auto text-slate-300 stroke-[1.5] mb-3" />

              <h3 className="font-serif font-bold text-slate-900">
                No communication records yet
              </h3>

              <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
                Prepared emails and drafts will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredHistory.map((message) => (
                <div
                  key={message.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openHistoryMessage(message)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openHistoryMessage(message);
                    }
                  }}
                  className="p-5 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_0.8fr_120px] gap-4 items-center hover:bg-[#F8FAFC] transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-inset focus:ring-blue-500/10"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[9px] font-mono font-bold uppercase tracking-wider border px-2 py-0.5 rounded ${
                          message.status === "Draft"
                            ? "bg-slate-100 text-slate-500 border-slate-200"
                            : message.status === "Email Could Not Be Sent"
                              ? "bg-red-50 text-red-700 border-red-100"
                            : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}
                      >
                        {message.status}
                      </span>

                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider border px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border-indigo-100">
                        {message.channel}
                      </span>
                    </div>

                    <h4 className="font-serif text-base font-bold text-slate-950 mt-2 truncate">
                      {message.subject}
                    </h4>

                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {message.body}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {message.courseCode}  -  {message.courseName}
                    </p>

                    <p className="text-[11px] text-slate-400 mt-1">
                      {message.recipientMode === "individual"
                        ? `${
                            message.recipientStudentEmail ||
                            message.recipientEmails?.[0] ||
                            message.toEmails?.[0] ||
                            "Email unavailable"
                          }`
                        : `${message.recipientCount || 0} BCC recipient${
                            Number(message.recipientCount || 0) === 1 ? "" : "s"
                          }`}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      Created
                    </p>

                    <p className="text-xs text-slate-600 mt-1">
                      {formatDateTime(message.createdAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteMessage(message.id);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/40 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {detailMessage && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close message details"
            onClick={() => setDetailMessage(null)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs"
          />

          <section className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#F8FAFC] p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-blue-700">
                    {detailMessage.status}
                  </span>
                  <span className="rounded border border-indigo-100 bg-indigo-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-indigo-700">
                    {detailMessage.channel}
                  </span>
                </div>
                <h3 className="mt-3 break-words font-serif text-xl font-bold text-slate-950">
                  {detailMessage.subject}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setDetailMessage(null)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 sm:grid-cols-2">
                <MessageDetail label="Course" value={`${detailMessage.courseCode || ""} - ${detailMessage.courseName || ""}`} />
                <MessageDetail
                  label="Recipient"
                  value={
                    detailMessage.recipientMode === "individual"
                      ? detailMessage.recipientStudentEmail ||
                        detailMessage.recipientEmails?.[0] ||
                        detailMessage.toEmails?.[0] ||
                        "Email unavailable"
                      : `${detailMessage.recipientCount || 0} course recipients`
                  }
                />
                <MessageDetail label="Sent" value={formatDateTime(detailMessage.createdAt)} />
                <MessageDetail
                  label="Email status"
                  value={
                    detailMessage.status === "Draft"
                      ? "Draft"
                      : detailMessage.status === "Email Could Not Be Sent"
                        ? "Email could not be sent"
                        : detailMessage.failedCount > 0
                          ? `Email sent to ${detailMessage.deliveredCount} of ${detailMessage.recipientCount} recipients`
                          : "Email sent"
                  }
                />
              </div>

              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Message
                </p>
                <div className="mt-2 whitespace-pre-wrap break-words rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                  {detailMessage.body}
                </div>
              </div>
            </div>
          </section>
        </div>,
        document.body
      )}

      {activeView === "templates" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MESSAGE_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-950">
                    {template.title}
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    Subject: {template.subject}
                  </p>
                </div>

                <FileText className="w-5 h-5 text-blue-600" />
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 whitespace-pre-line">
                {template.body}
              </p>

              <button
                type="button"
                onClick={() => applyTemplate(template)}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20"
              >
                <Mail className="w-4 h-4" />
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunicationTab({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
        active
          ? "bg-blue-50 text-blue-700 border-blue-100"
          : "bg-white text-slate-500 border-slate-200 hover:bg-[#F8FAFC]"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function SummaryBox({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] border border-slate-200 p-4 transition-all duration-300 hover:-translate-y-0.5 shadow-sm flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 stroke-[1.8]" />
      </div>

      <div className="min-w-0 space-y-0.5">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block truncate">
          {label}
        </span>

        <p className="font-mono text-sm font-bold text-slate-900 truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

function MessageDetail({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-xs font-semibold text-slate-700">
        {value || "Not available"}
      </p>
    </div>
  );
}
