const { test, expect } = require("@playwright/test");
const { hasCredentials, login, logout, getCredentials, collectPageErrors } = require("./helpers");

test.describe("Authentication", () => {
  test("teacher can log in successfully", async ({ page }) => {
    test.skip(!hasCredentials("teacher"), "Set TEACHER_EMAIL and TEACHER_PASSWORD to run this test.");

    const { getErrors } = collectPageErrors(page);
    await login(page, "teacher");
    await expect(page).toHaveURL(/\/teacher(?:\?|$)/);
    await expect(page.getByRole("button", { name: /create assignment/i }).first()).toBeVisible();
    expect(getErrors(), "no JS errors on teacher dashboard").toEqual([]);
  });

  test("student can log in successfully", async ({ page }) => {
    test.skip(!hasCredentials("student"), "Set STUDENT_EMAIL and STUDENT_PASSWORD to run this test.");

    const { getErrors } = collectPageErrors(page);
    await login(page, "student");
    await expect(page).toHaveURL(/\/student(?:\?|$)/);
    await expect(page.getByRole("button", { name: /enter course code/i })).toBeVisible();
    expect(getErrors(), "no JS errors on student dashboard").toEqual([]);
  });

  test("login with wrong password shows an error", async ({ page }) => {
    test.skip(!hasCredentials("teacher"), "Set TEACHER_EMAIL and TEACHER_PASSWORD to run this test.");

    const { getErrors } = collectPageErrors(page);
    const { email } = getCredentials("teacher");
    await page.goto("/login");
    await page.getByLabel(/campus email/i).fill(email);
    await page.getByLabel(/^password$/i).fill("definitely-not-the-real-password-123");
    await page.getByRole("button", { name: /sign in to portal/i }).click();

    await expect(page.locator("#auth-error")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#auth-error")).toContainText(/invalid|wrong|password|email|credentials|login/i);
    // VERIFY: A failed login must not throw uncaught JS — only render an error UI.
    // We filter the expected auth-error noise so we still catch real regressions.
    expect(
      getErrors().filter((e) => !/invalid|credentials|password|wrong/i.test(e)),
      "no JS errors during failed login (beyond expected auth error)"
    ).toEqual([]);
  });

  for (const account of [
    { route: "/signup", heading: "Student registration" },
    { route: "/instructor-signup", heading: "Instructor registration" },
  ]) {
    test(`${account.heading} is accessible on mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(account.route);

      await expect(page.getByRole("heading", { name: account.heading })).toBeVisible();
      await expect(page.getByLabel(/full name/i)).toHaveAttribute("autocomplete", "name");
      await expect(page.getByLabel(/campus email address/i)).toHaveAttribute("autocomplete", "email");
      await expect(page.getByLabel(/create password/i)).toHaveAttribute("autocomplete", "new-password");

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasHorizontalOverflow).toBe(false);
    });
  }

  test("logged-in user can log out", async ({ page }) => {
    test.skip(!hasCredentials("teacher"), "Set TEACHER_EMAIL and TEACHER_PASSWORD to run this test.");

    const { getErrors } = collectPageErrors(page);
    await login(page, "teacher");
    await logout(page);
    expect(getErrors(), "no JS errors during login/logout cycle").toEqual([]);
  });
});
