import { test, expect } from "@playwright/test";
import { login } from "./helpers.js";

function requireCredentials() {
  for (const [name, value] of Object.entries({
    TEACHER_EMAIL: process.env.TEACHER_EMAIL,
    TEACHER_PASSWORD: process.env.TEACHER_PASSWORD,
    STUDENT_EMAIL: process.env.STUDENT_EMAIL,
    STUDENT_PASSWORD: process.env.STUDENT_PASSWORD,
  })) {
    if (!value) throw new Error(`${name} is required`);
  }
}

async function discardRecoveredBuilderDraft(page) {
  const recovered = page.getByText("Continue your unfinished assignment?", {
    exact: true,
  });
  if (!(await recovered.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await page.getByRole("button", { name: /Discard and start fresh/i }).click();
  const confirmation = page.getByLabel("Discard this recovered draft?");
  await confirmation
    .getByRole("button", { name: /Discard and start fresh/i })
    .click();
}

async function createPublishedAssignment(page, title) {
  await page.getByRole("button", { name: /Create assignment/i }).first().click();
  await discardRecoveredBuilderDraft(page);

  await page.getByRole("button", { name: /Use manual setup/i }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const rubricSelect = page.getByRole("combobox").first();
  await rubricSelect.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByLabel("Assignment Title").fill(title);
  await page
    .getByLabel("Student Instructions")
    .fill("Write a clear process paragraph with an introduction, ordered steps, supporting details, and a conclusion.");

  const courseSelect = page.getByLabel("Course");
  const writingLevelOption = courseSelect.locator("option", { hasText: /writing level 2/i });
  if (await writingLevelOption.count()) {
    await courseSelect.selectOption(await writingLevelOption.first().getAttribute("value"));
  } else {
    await courseSelect.selectOption({ index: 1 });
  }

  await page.getByLabel("Due Date").fill("2026-09-15T17:30");
  await page.getByLabel(/Minimum words/i).fill("120");
  await page.getByLabel(/Maximum words/i).fill("300");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByLabel("AI feedback requests per student").fill("0");
  await page.getByRole("button", { name: "Continue to Review", exact: true }).click();
  await page.getByRole("button", { name: "Create Assignment", exact: true }).click();

  const progressButton = page.getByRole("button", {
    name: `Open ${title} student progress`,
  });
  await expect(progressButton).toBeVisible({ timeout: 20000 });

  const card = progressButton;
  await card.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(card.getByRole("button", { name: "Unpublish", exact: true })).toBeVisible();
  return card;
}

async function acceptHonorAgreement(page) {
  await page.getByText("Confirm your work", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Confirm your work/i })).toBeChecked();
}

async function deleteAssignment(page, title) {
  const result = await page.evaluate(async (assignmentTitle) => {
    const courseBody = await fetch("/api/classes").then((response) => response.json());
    for (const course of courseBody.classes || []) {
      const assignmentBody = await fetch(`/api/classes/${course.id}/assignments`).then((response) => response.json());
      const assignment = (assignmentBody.assignments || []).find((row) => row.title === assignmentTitle);
      if (!assignment) continue;
      const response = await fetch(`/api/assignments/${assignment.id}`, { method: "DELETE" });
      return { found: true, ok: response.ok, status: response.status };
    }
    return { found: false, ok: false, status: 404 };
  }, title);
  expect(result.found, `cleanup located ${title}`).toBe(true);
  expect(result.ok, `cleanup deleted ${title} (HTTP ${result.status})`).toBe(true);
}

test.describe("authenticated assignment lifecycle", () => {
  test.beforeAll(requireCredentials);

  test("teacher creates, student submits, teacher grades, student reviews, then cleanup", async ({ browser }) => {
    test.setTimeout(180000);
    const title = `E2E lifecycle ${Date.now()}`;
    const browserErrors = [];
    let teacherContext;
    let studentContext;

    try {
      teacherContext = await browser.newContext();
      const teacherPage = await teacherContext.newPage();
      teacherPage.setDefaultTimeout(15000);
      teacherPage.on("pageerror", (error) => browserErrors.push(`teacher pageerror: ${error}`));
      teacherPage.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(`teacher console: ${message.text()}`);
      });
      teacherPage.on("response", (response) => {
        if (response.status() >= 400) browserErrors.push(`teacher HTTP ${response.status()}: ${response.url()}`);
      });
      await login(teacherPage, "teacher");
      await teacherPage.goto("/teacher?tab=assignments");
      await createPublishedAssignment(teacherPage, title);

      studentContext = await browser.newContext();
      const studentPage = await studentContext.newPage();
      studentPage.setDefaultTimeout(15000);
      studentPage.on("pageerror", (error) => browserErrors.push(`student pageerror: ${error}`));
      studentPage.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(`student console: ${message.text()}`);
      });
      studentPage.on("response", (response) => {
        if (response.status() >= 400) browserErrors.push(`student HTTP ${response.status()}: ${response.url()}`);
      });
      await login(studentPage, "student");
      await studentPage.getByRole("button", { name: /^To do/ }).click();
      await expect(studentPage.getByText(title, { exact: true })).toBeVisible({ timeout: 20000 });

      const assignmentCard = studentPage
        .getByText(title, { exact: true })
        .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
      await assignmentCard.getByRole("button", { name: /Open assignment|Start assignment/i }).click();
      await expect(studentPage.getByRole("button", { name: "Continue to Draft", exact: true })).toBeVisible();

      await studentPage.getByRole("button", { name: "Continue to Draft", exact: true }).click();
      const skipDialog = studentPage.getByRole("heading", { name: "Continue without using the Coach?" });
      if (await skipDialog.isVisible().catch(() => false)) {
        await studentPage.getByRole("button", { name: "Continue to Draft", exact: true }).last().click();
      }

      const editor = studentPage.getByRole("textbox", { name: /Draft editor/ });
      await expect(editor).toBeVisible();
      const draft = Array.from(
        { length: 132 },
        (_, index) => `process${index + 1}`
      ).join(" ");
      await editor.fill(draft);
      await expect(editor).toHaveValue(draft);
      await expect(studentPage.getByText(/132\s*\/\s*300 words/i)).toBeVisible({ timeout: 10000 });
      await studentPage.waitForTimeout(2500);
      await expect(studentPage.getByText(/^Saved\s+\d/i)).toBeVisible({ timeout: 15000 });
      await studentPage.reload();
      const restoredEditor = studentPage.getByRole("textbox", { name: /Draft editor/ });
      await expect(restoredEditor).toBeVisible({ timeout: 20000 });
      await expect(restoredEditor).toHaveValue(draft);
      await studentPage.getByRole("button", { name: "Continue to Rubric Check", exact: true }).click();
      const continueToRubric = studentPage.getByRole("button", { name: "Continue to Rubric", exact: true });
      if (await continueToRubric.isVisible().catch(() => false)) await continueToRubric.click();
      await expect(studentPage.getByRole("heading", { name: "Rubric Self-Assessment" })).toBeVisible();
      for (let index = 0; index < 4; index += 1) {
        const activeCriterion = studentPage.locator("section").filter({
          has: studentPage.getByText(new RegExp(`Criterion ${index + 1} of 4`, "i")),
        });
        await activeCriterion.getByRole("button", { name: /^Excellent\b/ }).click();
      }
      await studentPage.getByRole("button", { name: "Save & Continue to Submit", exact: true }).click();
      await expect(studentPage.getByRole("checkbox", { name: /Confirm your work/i })).toBeVisible();

      await acceptHonorAgreement(studentPage);
      const submit = studentPage.getByRole("button", { name: "Submit", exact: true }).last();
      await expect(submit).toBeEnabled();
      await submit.dblclick();
      await expect(studentPage.getByRole("heading", { name: "Your assignment has been submitted" })).toBeVisible({ timeout: 20000 });

      await teacherPage.reload();
      const progressButton = teacherPage.getByRole("button", {
        name: `Open ${title} student progress`,
      });
      const card = progressButton;
      await card.getByRole("button", { name: /^(?:Review submissions|Submissions)$/i }).click();
      await expect(teacherPage.getByText("Student progress", { exact: true })).toBeVisible();
      await expect(teacherPage.getByRole("button", { name: "Review", exact: true })).toBeVisible();
      await teacherPage.getByRole("button", { name: "Review", exact: true }).click();

      await expect(teacherPage.getByRole("button", { name: /Grade.*Feedback/i }).first()).toBeVisible({ timeout: 20000 });
      const scoreInputs = teacherPage.locator('input[aria-label$=" score"]');
      await expect(scoreInputs.first()).toBeVisible();
      const scoreCount = await scoreInputs.count();
      for (let index = 0; index < scoreCount; index += 1) {
        const input = scoreInputs.nth(index);
        const maximum = Number(await input.getAttribute("max")) || 5;
        await input.fill(String(maximum));
      }

      const feedback = "Strong completion of the disposable end-to-end assignment. The grade and feedback publication path was verified.";
      await teacherPage.getByPlaceholder("Write clear, actionable feedback for the student...").fill(feedback);
      const submitGrade = teacherPage.getByRole("button", { name: "Submit grade", exact: true });
      await expect(submitGrade).toBeEnabled();
      await submitGrade.dblclick();
      await expect(teacherPage.getByText(/Grade and feedback submitted successfully/i)).toBeVisible({ timeout: 20000 });

      await studentPage.goto("/student");
      await studentPage.getByRole("button", { name: /^Graded/ }).click();
      await expect(studentPage.getByText(title, { exact: true })).toBeVisible({ timeout: 20000 });
      const gradedCard = studentPage
        .getByText(title, { exact: true })
        .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
      await expect(gradedCard.getByText(/Graded:/)).toBeVisible();
      await gradedCard.getByRole("button", { name: "Review feedback", exact: true }).click();
      await expect(studentPage.getByRole("button", { name: /Download Grade PDF/i })).toBeVisible();
      await studentPage.getByRole("button", { name: /Check Instructor Feedback/i }).click();
      await expect(studentPage.getByText(feedback, { exact: true })).toBeVisible({ timeout: 20000 });

      if (browserErrors.length) {
        console.log("[LIFECYCLE] browser console diagnostics:", browserErrors);
      }
    } finally {
      if (!teacherContext) teacherContext = await browser.newContext();
      let page = teacherContext.pages()[0] || (await teacherContext.newPage());
      try {
        if (!/\/teacher/.test(page.url())) await login(page, "teacher");
        await deleteAssignment(page, title);
      } catch (error) {
        console.warn(`Cleanup failed for ${title}:`, error);
      }
      await studentContext?.close();
      await teacherContext?.close();
    }
  });
});
