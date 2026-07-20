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
  await page.addInitScript((data) => {
    localStorage.setItem("praxis_mock_data", JSON.stringify(data));
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

  await page.goto("/teacher");
  await page.getByRole("button", { name: /Assignments/ }).click();
  await page.getByRole("button", { name: /New submission/ }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();

  await expect(page.getByText("Student Text", { exact: true })).toBeVisible();
  await expect(page.getByText("Rubric", { exact: true })).toBeVisible();
  await expect(page.getByText("AI & Teacher Feedback", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Run AI check" }).click();
  await expect(page.getByText("Clear argument with relevant support.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply rubric scores" }).click();
  await expect(page.getByText("3 / 4", { exact: true })).toHaveCount(2);

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
  await expect.poll(async () => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("praxis_mock_data"));
    const saved = data.submissions.find((item) => item.id === "submission_e2e");
    return {
      feedback: saved.feedback,
      score: saved.score,
      annotations: saved.annotations?.length || 0,
    };
  })).toEqual({
    feedback: "Explain how the evidence proves the thesis.",
    score: 6,
    annotations: 1,
  });
});
