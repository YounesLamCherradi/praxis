const { test, expect } = require("@playwright/test");
const { hasAllCredentials, login, collectPageErrors } = require("./helpers");

test.describe("Authenticated redesigned workspaces", () => {
  test.skip(!hasAllCredentials(), "Teacher and student credentials are required.");

  test("protected workspaces redirect an anonymous visitor", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const route of ["/teacher", "/student"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    }

    await context.close();
  });

  test("teacher assignment list remains stable after progress review", async ({ page }) => {
    const { getErrors } = collectPageErrors(page);
    await login(page, "teacher");
    await page.getByText("Assignments", { exact: true }).first().click();

    await expect(page.getByRole("heading", { name: /your assignments/i })).toBeVisible();
    const reviewButtons = page.getByRole("button", { name: /review submissions/i });
    const before = await reviewButtons.count();
    expect(before).toBeGreaterThan(0);

    await reviewButtons.first().click();
    await expect(page.getByText(/student progress/i).first()).toBeVisible();

    // An accidental click on the dimmed backdrop must not dismiss the modal.
    await page.mouse.click(20, 300);
    await expect(page.getByText(/student progress/i).first()).toBeVisible();

    await page.getByRole("button", { name: /back to list/i }).click();
    await expect(page.getByRole("heading", { name: /your assignments/i })).toBeVisible();
    await expect(reviewButtons).toHaveCount(before);
    expect(getErrors(), "no JS errors while reviewing and returning").toEqual([]);
  });

  test("create-assignment modal resists accidental backdrop clicks", async ({ page }) => {
    const { getErrors } = collectPageErrors(page);
    await login(page, "teacher");
    await page.getByRole("button", { name: /create assignment/i }).first().click();
    await expect(page.getByRole("heading", { name: /create assignment/i })).toBeVisible();

    await page.mouse.click(15, 300);
    await expect(page.getByRole("heading", { name: /create assignment/i })).toBeVisible();
    expect(getErrors(), "no JS errors when the modal backdrop is clicked").toEqual([]);
  });

  test("teacher can create and clean up a manual assignment", async ({ page }) => {
    const { getErrors } = collectPageErrors(page);
    const title = `Authenticated assignment audit ${Date.now()}`;
    await login(page, "teacher");
    await page.getByRole("button", { name: /create assignment/i }).first().click();

    const startFresh = page.getByRole("button", { name: /(?:discard and )?start fresh/i });
    const recoveredDraftAppeared = await startFresh
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (recoveredDraftAppeared) {
      await startFresh.click();
      await expect(page.getByText(/discard this recovered draft/i)).toBeVisible();
      await page
        .getByLabel("Discard this recovered draft?")
        .getByRole("button", { name: /discard and start fresh/i })
        .click();
    }

    await page.getByRole("button", { name: /use manual setup/i }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const rubricSelect = page.getByRole("combobox").first();
    const rubricOptions = await rubricSelect.locator('option:not([value=""])').count();
    expect(rubricOptions).toBeGreaterThan(0);
    await rubricSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByLabel("Assignment Title").fill(title);
    await page.getByLabel("Student Instructions").fill(
      "Write a focused paragraph explaining one learning strategy and support it with a specific example."
    );
    await page.getByLabel("Course").selectOption({ index: 1 });
    await page.getByLabel("Due Date").fill("2026-09-15T17:30");
    await page.getByLabel("Minimum Words").fill("120");
    await page.getByLabel("Maximum Words").fill("300");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /continue to review/i }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Create Assignment", exact: true }).click();

    const card = page.getByRole("button", {
      name: `Open ${title} student progress`,
    });
    await expect(card).toBeVisible({ timeout: 30_000 });

    await card.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(/delete this assignment/i)).toBeVisible();
    await page.getByRole("button", { name: "Delete assignment", exact: true }).click();
    await expect(card).toHaveCount(0, { timeout: 30_000 });
    expect(getErrors(), "no JS errors during create and cleanup").toEqual([]);
  });

  test("student filters and assignment restoration work", async ({ page }) => {
    const { getErrors } = collectPageErrors(page);
    await login(page, "student");
    await expect(page.getByRole("heading", { name: /your assignments/i })).toBeVisible();

    const toDo = page.getByRole("button", { name: /^to do\b/i });
    const submitted = page.getByRole("button", { name: /^submitted\b/i });
    const graded = page.getByRole("button", { name: /^graded\b/i });
    const all = page.getByRole("button", { name: /^all\s+\d+$/i });
    for (const filter of [toDo, submitted, graded, all]) {
      await expect(filter).toBeVisible();
      await filter.click();
    }

    await toDo.click();
    const continueButtons = page.getByRole("button", { name: /continue assignment/i });
    const count = await continueButtons.count();
    expect(count).toBeGreaterThan(0);
    await continueButtons.first().click();
    await expect(page).toHaveURL(/assignment=/);

    const assignmentUrl = page.url();
    await page.reload();
    await expect(page).toHaveURL(assignmentUrl);
    await expect(page.getByText(/back to dashboard/i).first()).toBeVisible();
    expect(getErrors(), "no JS errors while filtering and restoring an assignment").toEqual([]);
  });
});
