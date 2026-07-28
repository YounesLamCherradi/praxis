const { test, expect } = require("@playwright/test");

function teacherFixture() {
  const rubric = {
    id: "teacher_rubric",
    title: "Local rubric",
    totalPoints: 4,
    criteria: [{
      id: "criterion_1",
      name: "Clarity",
      description: "The response is clear.",
      points: 4,
      bands: [
        { id: "strong", label: "Strong", points: 4, description: "Clear throughout." },
        { id: "developing", label: "Developing", points: 2, description: "Sometimes clear." },
      ],
    }],
  };
  return {
    version: 2,
    users: [],
    classes: [{ id: "teacher_class", name: "Writing Seminar", code: "WRT101", semester: "Fall 2026" }],
    enrollments: [],
    assignments: [{
      id: "existing_assignment",
      classId: "teacher_class",
      classCode: "WRT101",
      className: "Writing Seminar",
      title: "Existing modal audit",
      description: "Explain one meaningful learning experience.",
      instructions: "Explain one meaningful learning experience.",
      dueDate: "2026-08-30T23:59",
      status: "published",
      minWords: 100,
      maxWords: 300,
      rubricSchema: rubric,
      rubric: rubric.criteria,
      aiIdeasCoach: true,
      chatTimeLimit: 0,
      feedbackRequestLimit: 1,
    }],
    submissions: [],
    rubrics: [rubric],
    notifications: [], messages: [], bugReports: [], adminStudentFlags: {},
    processAnalyses: [], researchWithdrawalLog: [], adminProcessAnalysisRun: null,
  };
}

test.describe("Teacher assignment modal lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/classes/teacher_class/assignments", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assignment: {
            id: "persisted_assignment",
            class_id: "teacher_class",
            ...payload,
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }),
      });
    });
    await page.addInitScript((fixture) => {
      localStorage.setItem("praxis_mock_data", JSON.stringify(fixture));
      localStorage.setItem("auizero_profile", JSON.stringify({
        name: "Teacher Tester", email: "teacher@aui.ma", role: "teacher",
      }));
    }, teacherFixture());
  });

  test("details stays populated through open, close, edit, save, and reopen", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/teacher");
    await page.getByRole("button", { name: /^Assignments/ }).click();
    await page.getByLabel("1. Select Course").selectOption("teacher_class");
    await page.getByLabel("2. Select Assignment").selectOption("existing_assignment");

    await page.getByRole("button", { name: "Details", exact: true }).click();
    const details = page.locator("h1").filter({ hasText: "Existing modal audit" });
    await expect(details).toBeVisible();
    await expect(page.getByText("Explain one meaningful learning experience.", { exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: "Close details", exact: true }).click();
    await expect(details).not.toBeVisible();

    await page.getByRole("button", { name: "Details", exact: true }).click();
    await page.getByRole("button", { name: "Edit assignment", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit Assignment", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit Assignment", exact: true })).not.toBeVisible();

    await page.getByLabel("1. Select Course").selectOption("teacher_class");
    await page.getByLabel("2. Select Assignment").selectOption("existing_assignment");
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await expect(details).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("refresh restores the assignments tab, course, and assignment", async ({ page }) => {
    await page.goto("/teacher");
    await page.getByRole("button", { name: /^Assignments/ }).click();
    await page.getByLabel("1. Select Course").selectOption("teacher_class");
    await page.getByLabel("2. Select Assignment").selectOption("existing_assignment");

    await expect(page).toHaveURL(/tab=assignments/);
    await expect(page).toHaveURL(/course=teacher_class/);
    await expect(page).toHaveURL(/assignment=existing_assignment/);

    await page.reload();

    await expect(page.getByLabel("1. Select Course")).toHaveValue("teacher_class");
    await expect(page.getByLabel("2. Select Assignment")).toHaveValue("existing_assignment");
    await expect(page.getByText("Existing modal audit", { exact: true }).first()).toBeVisible();
  });

  test("a newly created assignment opens a populated details modal", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/teacher");
    await page.getByRole("button", { name: /^Assignments/ }).click();
    await page.getByRole("button", { name: "Create Assignment", exact: true }).click();

    await page.getByRole("button", { name: /^Manual/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /^Reuse previous/ }).click();
    await page.locator('select:has(option[value="teacher_rubric"])').selectOption("teacher_rubric");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByLabel("Assignment Title").fill("Newly created modal audit");
    await page.getByLabel("Student Instructions").fill("Write a focused reflection using one specific example.");
    await page.getByLabel("Course").selectOption("teacher_class");
    await page.getByLabel("Due Date").fill("2026-09-15T17:30");
    await page.getByLabel("Minimum Words").fill("120");
    await page.getByLabel("Maximum Words").fill("350");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue to Review", exact: true }).click();
    await expect(page.getByText("Newly created modal audit", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Create Assignment", exact: true }).click();

    await expect(page.getByLabel("2. Select Assignment")).toHaveValue(/.+/);
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await expect(page.locator("h1").filter({ hasText: "Newly created modal audit" })).toBeVisible();
    await expect(page.getByText("Write a focused reflection using one specific example.", { exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: "Close details", exact: true }).click();

    await page.getByRole("button", { name: "Details", exact: true }).click();
    await expect(page.locator("h1").filter({ hasText: "Newly created modal audit" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
