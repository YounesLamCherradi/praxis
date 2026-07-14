import React, { useEffect, useMemo, useState } from "react";
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
  Users,
} from "lucide-react";

import { useTeacherWorkspace } from "../../contexts/TeacherWorkspaceContext";
import {
  getPraxisData,
  savePraxisData,
} from "../../services/praxisMockStore";

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

  const [data, setData] = useState(() => getPraxisData());
  const [activeView, setActiveView] = useState("compose");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [recipientMode, setRecipientMode] = useState("all");

  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [showBccList, setShowBccList] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [systemMessage, setSystemMessage] = useState("");
  const [systemError, setSystemError] = useState("");

  useEffect(() => {
    const latestData = getPraxisData();
    setData(latestData);

    if (!selectedCourseId && classes[0]?.id) {
      setSelectedCourseId(String(classes[0].id));
    }
  }, [classes, selectedCourseId]);

  const enrollments = data.enrollments || [];
  const communicationMessages = data.communicationMessages || [];

  const selectedCourse = useMemo(() => {
    return (
      classes.find((course) => String(course.id) === String(selectedCourseId)) ||
      classes[0] ||
      null
    );
  }, [classes, selectedCourseId]);

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

  const bccEmails = useMemo(() => {
    return uniqueEmails(
      courseEnrollments.map((enrollment) => enrollment.studentEmail)
    );
  }, [courseEnrollments]);

  const filteredHistory = useMemo(() => {
    const query = historySearch.toLowerCase().trim();

    return communicationMessages.filter((message) => {
      const matchesSearch =
        !query ||
        message.subject?.toLowerCase().includes(query) ||
        message.body?.toLowerCase().includes(query) ||
        message.courseCode?.toLowerCase().includes(query) ||
        message.courseName?.toLowerCase().includes(query);

      return matchesSearch;
    });
  }, [communicationMessages, historySearch]);

  function persistCommunicationMessage(message, successText) {
    const latestData = getPraxisData();

    const updatedMessages = [
      message,
      ...(latestData.communicationMessages || []),
    ];

    const nextData = {
      ...latestData,
      communicationMessages: updatedMessages,
    };

    savePraxisData(nextData);
    setData(nextData);

    setSystemMessage(successText);
    setSystemError("");
  }

  function resetComposer() {
    setSubject("");
    setMessageBody("");
    setShowBccList(false);
  }

  function validateComposer() {
    setSystemMessage("");
    setSystemError("");

    if (!selectedCourse) {
      setSystemError("Please select a course first.");
      return false;
    }

    if (bccEmails.length === 0) {
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

  function handlePrepareSend(e) {
    e.preventDefault();

    if (!validateComposer()) return;

    const message = {
      id: `comm_${Date.now()}`,
      type: "email",
      channel: "BCC Email",
      status: "Prepared",
      frontendOnly: true,

      courseId: selectedCourse.id,
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,

      recipientMode,
      recipientCount: bccEmails.length,
      bccEmails,

      subject: subject.trim(),
      body: messageBody.trim(),

      createdAt: new Date().toISOString(),
    };

    persistCommunicationMessage(
      message,
      `Email prepared for ${bccEmails.length} student${
        bccEmails.length === 1 ? "" : "s"
      } using BCC. Backend sending will be connected later.`
    );

    resetComposer();
    setActiveView("history");
  }

  function handleSaveDraft() {
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

    const message = {
      id: `draft_${Date.now()}`,
      type: "email",
      channel: "BCC Email",
      status: "Draft",
      frontendOnly: true,

      courseId: selectedCourse.id,
      courseCode: selectedCourse.code,
      courseName: selectedCourse.name,

      recipientMode,
      recipientCount: bccEmails.length,
      bccEmails,

      subject: subject.trim() || "Untitled draft",
      body: messageBody.trim(),

      createdAt: new Date().toISOString(),
    };

    persistCommunicationMessage(message, "Draft saved locally.");
    resetComposer();
    setActiveView("history");
  }

  function handleDeleteMessage(messageId) {
    const confirmed = window.confirm(
      "Delete this communication record from the local frontend history?"
    );

    if (!confirmed) return;

    const latestData = getPraxisData();

    const updatedMessages = (latestData.communicationMessages || []).filter(
      (message) => String(message.id) !== String(messageId)
    );

    const nextData = {
      ...latestData,
      communicationMessages: updatedMessages,
    };

    savePraxisData(nextData);
    setData(nextData);

    setSystemMessage("Communication record deleted.");
    setSystemError("");
  }

  function applyTemplate(template) {
    setSubject(template.subject);
    setMessageBody(template.body);
    setActiveView("compose");
    setSystemMessage(`Template applied: ${template.title}`);
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
              Course Communication Center
            </h2>

            <p className="text-xs text-slate-500 font-medium max-w-2xl leading-relaxed">
              Prepare course announcements, email enrolled students using BCC,
              save drafts, and review local communication history. This is
              frontend-only until backend email sending is connected.
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

            <CommunicationTab
              active={activeView === "templates"}
              label="Templates"
              icon={FileText}
              onClick={() => setActiveView("templates")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <SummaryBox
            label="Courses"
            value={classes.length}
            icon={Users}
          />

          <SummaryBox
            label="Selected Recipients"
            value={bccEmails.length}
            icon={Mail}
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
                  Compose Email
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Write an announcement for enrolled students. Recipients will
                  be placed in BCC.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                    Course
                  </label>

                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    {classes.length === 0 ? (
                      <option value="">No courses available</option>
                    ) : (
                      classes.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code} — {course.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                    Recipients
                  </label>

                  <select
                    value={recipientMode}
                    onChange={(e) => setRecipientMode(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-slate-200 text-slate-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="all">All enrolled students</option>
                  </select>
                </div>
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
                  Save Draft
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20"
                >
                  <Send className="w-4 h-4" />
                  Prepare Email to {bccEmails.length} Student
                  {bccEmails.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />

                  <h3 className="font-serif text-sm font-bold text-slate-950">
                    BCC Recipients
                  </h3>
                </div>

                <p className="text-3xl font-serif font-black text-slate-950 mt-4">
                  {bccEmails.length}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  enrolled student{bccEmails.length === 1 ? "" : "s"} in{" "}
                  <span className="font-bold text-slate-800">
                    {selectedCourse?.code || "No course"}
                  </span>
                </p>

                <button
                  type="button"
                  onClick={() => setShowBccList((prev) => !prev)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white transition-all"
                >
                  {showBccList ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {showBccList ? "Hide BCC List" : "Preview BCC List"}
                </button>
              </div>

              {showBccList && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm max-h-72 overflow-y-auto space-y-2">
                  {bccEmails.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No enrolled student emails available.
                    </p>
                  ) : (
                    bccEmails.map((email) => (
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

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-900">
                  Frontend preview only
                </p>

                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                  This page prepares the email UI, BCC recipient list, drafts,
                  and local message history. Real sending will be connected
                  later through the Node.js/Express backend.
                </p>
              </div>
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
                Local frontend history of prepared emails and saved drafts.
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
                  className="p-5 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_0.8fr_120px] gap-4 items-center hover:bg-[#F8FAFC] transition-all"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[9px] font-mono font-bold uppercase tracking-wider border px-2 py-0.5 rounded ${
                          message.status === "Draft"
                            ? "bg-slate-100 text-slate-500 border-slate-200"
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
                      {message.courseCode} — {message.courseName}
                    </p>

                    <p className="text-[11px] text-slate-400 mt-1">
                      {message.recipientCount} BCC recipient
                      {message.recipientCount === 1 ? "" : "s"}
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
                    onClick={() => handleDeleteMessage(message.id)}
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