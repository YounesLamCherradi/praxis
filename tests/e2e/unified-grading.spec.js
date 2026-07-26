const { test, expect } = require("@playwright/test");

function buildGradingFixture() {
  const bands = [
    { id: "excellent", label: "Excellent", points: 4, description: "Fully meets expectations." },
    { id: "good", label: "Good", points: 3, description: "Meets expectations." },
  ];
  const rubric = {
    id: "rubric_e2e",
    title: "Essay Rubric",
    criteria: ["Thesis", "Evidence"].map((name, index) => ({
      id: `criterion_${index + 1}`,
      name,
      points: 4,
      bands,
    })),
  };
  const assignment = {
    id: "assignment_e2e",
    classId: "class_e2e",
    classCode: "ENG-E2E",
    title: "Unified grading test",
    status: "published",
    rubricSchema: rubric,
  };
  const submission = {
    id: "submission_e2e",
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    studentName: "Ava Tester",
    studentEmail: "ava@test.local",
    status: "Submitted",
    isCurrent: true,
    submittedAt: new Date().toISOString(),
    submittedText: "Fear drives the community to make irrational decisions. Abigail uses accusations to control others.",
    rubricSchema: rubric,
  };

  return {
    version: 2,
    users: [],
    classes: [{ id: "class_e2e", name: "English E2E", code: "ENG-E2E" }],
    enrollments: [{
      classId: "class_e2e",
      classCode: "ENG-E2E",
      studentName: submission.studentName,
      studentEmail: submission.studentEmail,
    }],
    assignments: [assignment],
    submissions: [submission],
    rubrics: [],
    notifications: [],
    messages: [],
    bugReports: [],
    adminStudentFlags: {},
    processAnalyses: [],
    researchWithdrawalLog: [],
    adminProcessAnalysisRun: null,
  };
}

test("combined grading workspace keeps AI, rubric, feedback, annotations, and save connected", async ({ page }) => {
  const fixture = buildGradingFixture();
  let savedReviewPayload = null;
  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      profile: {
        id: "teacher_e2e",
        name: "Teacher Tester",
        email: "teacher@test.local",
        role: "teacher",
      },
    }),
  }));
  await page.route("**/api/classes", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      classes: [{
        id: "class_e2e",
        name: "English E2E",
        invite_code: "ENG-E2E",
        teacher_id: "teacher_e2e",
        is_published: true,
      }],
    }),
  }));
  await page.route("**/api/classes/class_e2e/assignments", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      assignments: [{
        id: "assignment_e2e",
        class_id: "class_e2e",
        title: fixture.assignments[0].title,
        prompt: "Review the argument.",
        status: "published",
        rubric: fixture.assignments[0].rubricSchema,
      }],
    }),
  }));
  const databaseSubmission = {
    id: "submission_e2e",
    assignment_id: "assignment_e2e",
    student_id: "student_e2e",
    status: "submitted",
    final_text: fixture.submissions[0].submittedText,
    teacher_review: {},
    submitted_at: fixture.submissions[0].submittedAt,
    profiles: { id: "student_e2e", name: "Ava Tester" },
    version: 1,
  };
  await page.route("**/api/classes/class_e2e/submissions", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ submissions: [databaseSubmission] }),
  }));
  await page.route("**/api/teacher/submissions", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ submissions: [databaseSubmission] }),
  }));
  await page.route("**/api/rubrics", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ rubrics: [] }),
  }));
  await page.addInitScript((data) => {
    localStorage.setItem("praxis_mock_data", JSON.stringify(data));
    localStorage.setItem("auizero_profile", JSON.stringify({
      id: "teacher_e2e",
      name: "Teacher Tester",
      email: "teacher@test.local",
      role: "teacher",
    }));
  }, fixture);

  await page.route("**/api/teacher/ai-review-submission", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      summary: "Clear argument with relevant support.",
      feedback: "Explain how the evidence proves the thesis.",
      strengths: ["Clear thesis"],
      improvements: ["Deepen analysis"],
      criteria: [
        { criterionId: "criterion_1", criterionName: "Thesis", score: 3, bandId: "good", bandLabel: "Good" },
        { criterionId: "criterion_2", criterionName: "Evidence", score: 3, bandId: "good", bandLabel: "Good" },
      ],
      finalScore: 6,
    }),
  }));
  await page.route("**/api/submissions/submission_e2e", async (route) => {
    const payload = route.request().postDataJSON() || {};
    if (route.request().method() === "PATCH") {
      savedReviewPayload = payload;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        submission: {
          id: "submission_e2e",
          assignment_id: "assignment_e2e",
          student_id: "student_e2e",
          status: payload.status || "graded",
          final_text: fixture.submissions[0].submittedText,
          teacher_review: payload.teacher_review || {},
          submitted_at: fixture.submissions[0].submittedAt,
          version: 2,
          updated_at: new Date().toISOString(),
        },
      }),
    });
  });

  await page.goto("/teacher");
  await page.getByRole("button", { name: /Assignments/ }).click();
  await page.locator("select").nth(0).selectOption("class_e2e");
  await page.locator("select").nth(1).selectOption("assignment_e2e");
  await page.getByRole("button", { name: "Review", exact: true }).click();

  await expect(page.getByText("Student Text", { exact: true })).toBeVisible();
  await expect(page.getByText("Rubric", { exact: true })).toBeVisible();
  await expect(page.getByText("AI & Instructor Feedback", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Run AI check" }).click();
  await expect(page.getByText("Clear argument with relevant support.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply rubric scores" }).click();
  await expect(page.getByText("AI suggestion applied", { exact: true })).toBeVisible();
  await expect(page.getByRole("spinbutton")).toHaveValue("3");

  await page.getByRole("button", { name: "Use as feedback" }).click();
  await expect(page.getByPlaceholder("Write clear, actionable feedback for the student..."))
    .toHaveValue("Explain how the evidence proves the thesis.");

  const studentText = page.getByText(fixture.submissions[0].submittedText, { exact: true });
  await studentText.evaluate((node) => {
    const range = document.createRange();
    range.setStart(node.firstChild, 0);
    range.setEnd(node.firstChild, 11);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await expect(page.getByText("Annotate selection", { exact: true })).toBeVisible();
  await page.getByTitle("GOOD  -  Good").click();

  await page.getByRole("button", { name: "Save Review", exact: true }).click();
  await expect.poll(() => {
    const saved = savedReviewPayload?.teacher_review || {};
    return {
      status: saved.status,
      feedback: saved.finalNotes,
      score: saved.finalScore,
      annotations: saved.annotations?.length || 0,
    };
  }).toEqual({
    status: "graded",
    feedback: "Explain how the evidence proves the thesis.",
    score: 6,
    annotations: 1,
  });
});

test("student sees the saved grade, comment, rubric result, and highlight", async ({ page }) => {
  const fixture = buildGradingFixture();
  const rubric = fixture.assignments[0].rubricSchema;
  const finalText = fixture.submissions[0].submittedText;
  const reviewedAt = "2026-07-23T23:05:00.000Z";
  const gradedSubmission = {
    id: "submission_e2e",
    assignment_id: "assignment_e2e",
    student_id: "student_e2e",
    status: "graded",
    final_text: finalText,
    draft_text: finalText,
    submitted_at: fixture.submissions[0].submittedAt,
    updated_at: reviewedAt,
    teacher_review: {
      status: "graded",
      savedAt: reviewedAt,
      finalScore: 6,
      finalNotes: "Explain how the evidence proves the thesis.",
      annotations: [{
        id: "annotation_e2e",
        rangeStart: 0,
        rangeEnd: 11,
        selectedText: finalText.slice(0, 11),
        comment: "Strong opening claim.",
        code: "GOOD",
        type: "positive",
      }],
      rubricId: rubric.id,
      rubricTitle: rubric.title,
      rubricTotal: 8,
      rubricScores: {
        criterion_1: {
          criterionId: "criterion_1",
          criterionName: "Thesis",
          score: 3,
          maxPoints: 4,
          comment: "Clear position.",
        },
        criterion_2: {
          criterionId: "criterion_2",
          criterionName: "Evidence",
          score: 3,
          maxPoints: 4,
          comment: "Add deeper explanation.",
        },
      },
    },
  };

  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      profile: {
        id: "student_e2e",
        name: "Ava Tester",
        email: "ava@test.local",
        role: "student",
      },
    }),
  }));
  await page.route("**/api/student/classes", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      classes: [{
        id: "class_e2e",
        name: "English E2E",
        invite_code: "ENG-E2E",
        is_published: true,
      }],
      pendingClasses: [],
    }),
  }));
  await page.route("**/api/classes/class_e2e/assignments", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      assignments: [{
        id: "assignment_e2e",
        class_id: "class_e2e",
        title: fixture.assignments[0].title,
        prompt: "Review the argument.",
        status: "published",
        word_count_min: 10,
        word_count_max: 400,
        rubric,
      }],
    }),
  }));
  await page.route("**/api/student/submissions**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ submissions: [gradedSubmission] }),
  }));
  await page.route("**/api/assignments/assignment_e2e/my-submission", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ submission: gradedSubmission }),
  }));
  await page.route("**/api/submissions/submission_e2e", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      submission: {
        ...gradedSubmission,
        detail_loaded: true,
      },
    }),
  }));

  await page.goto("/student");
  await expect(page.getByText("Unified grading test", { exact: true })).toBeVisible();
  await expect(page.getByText("Score: 6", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /View Grade & Feedback/i }).click();
  await page.getByRole("button", { name: /Check Instructor Feedback/i }).click();

  await expect(
    page.getByText("Explain how the evidence proves the thesis.", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: /Highlights/i }).click();
  await page.locator("mark").click();
  await expect(page.getByText("Strong opening claim.", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Rubric 2", exact: true }).click();
  await expect(page.getByText("Clear position.", { exact: true })).toBeVisible();
  await expect(page.getByText("Add deeper explanation.", { exact: true })).toBeVisible();
});
