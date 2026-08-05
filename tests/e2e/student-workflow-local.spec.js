const { test, expect } = require("@playwright/test");

function buildStudentWorkflowFixture() {
  const bands = [
    { id: "excellent", label: "Excellent", points: 4, description: "Fully meets expectations." },
    { id: "good", label: "Good", points: 3, description: "Meets expectations." },
    { id: "developing", label: "Developing", points: 2, description: "Partly meets expectations." },
  ];
  const rubric = {
    id: "student_flow_rubric",
    title: "Argument Essay Rubric",
    totalPoints: 8,
    criteria: ["Thesis & Focus", "Evidence & Support"].map((name, index) => ({
      id: `criterion_${index + 1}`,
      name,
      description: `Review ${name.toLowerCase()} in your draft.`,
      points: 4,
      bands,
    })),
  };
  const draft = "The death penalty should be abolished because mistakes in the justice system cannot be reversed. Innocent people deserve protection from irreversible punishment.";
  const assignment = {
    id: "student_flow_assignment",
    classId: "student_flow_class",
    classCode: "ENG",
    title: "Student workflow audit",
    description: "Write a clear argument and support it with evidence.",
    instructions: "Write a clear argument and support it with evidence.",
    status: "published",
    wordCountMin: 10,
    wordCountMax: 400,
    aiIdeasCoach: true,
    aiDraftFeedback: true,
    allowAI: true,
    feedbackRequestLimit: 3,
    rubricSchema: rubric,
    rubric: rubric.criteria,
  };
  const feedback = {
    id: "feedback_1",
    role: "ai",
    source: "ai",
    type: "draft_review",
    saved: true,
    createdAt: new Date().toISOString(),
    reviewedText: draft,
    draftTextAtRequest: draft,
    issues: [{
      id: "issue_1",
      quote: "mistakes in the justice system",
      problem: "Explain what kind of mistakes could happen.",
      suggestion: "Add one concrete example.",
    }],
    items: [{
      id: "issue_1",
      quote: "mistakes in the justice system",
      problem: "Explain what kind of mistakes could happen.",
      suggestion: "Add one concrete example.",
    }],
  };

  return {
    version: 2,
    users: [],
    classes: [{ id: "student_flow_class", name: "English", code: "ENG" }],
    enrollments: [{
      id: "student_flow_enrollment",
      classId: "student_flow_class",
      classCode: "ENG",
      studentName: "Student Tester",
      studentEmail: "student@aui.ma",
      status: "active",
    }],
    assignments: [assignment],
    submissions: [{
      id: "student_flow_submission",
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      studentName: "Student Tester",
      studentEmail: "student@aui.ma",
      status: "draft",
      isCurrent: true,
      draftText: draft,
      finalText: draft,
      wordCount: draft.split(/\s+/).length,
      chatHistory: [
        { id: "welcome", role: "assistant", content: "Welcome." },
        { id: "student", role: "user", content: "I want to argue against it." },
      ],
      feedbackHistory: [feedback],
      selfRubricScores: {},
    }],
    rubrics: [rubric],
    notifications: [],
    messages: [],
    bugReports: [],
    adminStudentFlags: {},
    processAnalyses: [],
    researchWithdrawalLog: [],
    adminProcessAnalysisRun: null,
  };
}

test.describe("Local student assignment workflow", () => {
  test.beforeEach(async ({ page }) => {
    const fixture = buildStudentWorkflowFixture();
    const durableSubmission = fixture.submissions[0];
    await page.route("**/api/auth/me", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          id: "student_flow_student",
          name: "Student Tester",
          email: "student@aui.ma",
          role: "student",
        },
      }),
    }));
    const asDatabaseSubmission = (overrides = {}) => ({
      id: "student_flow_submission",
      assignment_id: "student_flow_assignment",
      student_id: "student_flow_student",
      status: "draft",
      draft_text: durableSubmission.draftText,
      final_text: durableSubmission.finalText,
      chat_history: durableSubmission.chatHistory,
      feedback_history: durableSubmission.feedbackHistory,
      idea_responses: [],
      writing_events: [],
      keystroke_log: [],
      outline: {},
      reflections: {},
      self_assessment: {},
      teacher_review: {},
      version: 1,
      updated_at: new Date().toISOString(),
      ...overrides,
    });
    await page.route("**/api/assignments/student_flow_assignment/my-submission", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ submission: asDatabaseSubmission() }),
      });
    });
    await page.route("**/api/submissions/student_flow_submission", async (route) => {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          submission: asDatabaseSubmission({
            ...payload,
            version: 2,
            updated_at: new Date().toISOString(),
          }),
        }),
      });
    });
    await page.route("**/api/assignments/student_flow_assignment/submit", async (route) => {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          submission: asDatabaseSubmission({
            ...payload,
            status: "submitted",
            submitted_at: new Date().toISOString(),
            version: 3,
          }),
        }),
      });
    });
    await page.addInitScript((data) => {
      if (!localStorage.getItem("praxis_mock_data")) {
        localStorage.setItem("praxis_mock_data", JSON.stringify(data));
      }
      if (!localStorage.getItem("auizero_profile")) {
        localStorage.setItem("auizero_profile", JSON.stringify({
          name: "Student Tester",
          email: "student@aui.ma",
          role: "student",
        }));
      }
      if (!localStorage.getItem("praxis_student_step_overrides")) {
        localStorage.setItem("praxis_student_step_overrides", JSON.stringify({
          student_flow_assignment: 1,
        }));
      }
    }, fixture);
  });

  test("assignment without a rubric skips directly to Submit", async ({ page }) => {
    await page.addInitScript(() => {
      const data = JSON.parse(localStorage.getItem("praxis_mock_data"));
      data.assignments[0].rubricSchema = null;
      data.assignments[0].rubric = [];
      data.submissions[0].selfRubricScores = {};
      localStorage.setItem("praxis_mock_data", JSON.stringify(data));
      localStorage.setItem("praxis_student_step_overrides", JSON.stringify({
        student_flow_assignment: 2,
      }));
    });

    await page.goto("/student");
    await page.getByRole("button", { name: /Continue Assignment/ }).click();
    await expect(page).toHaveURL(/assignment=student_flow_assignment/);
    await expect(page).toHaveURL(/step=2/);
    await expect(page.getByText("Draft Editor", { exact: true })).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Rubric", exact: true })
    ).toBeDisabled();

    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText("Step 4: Submit Assignment", { exact: true })).toBeVisible();
    await expect(page.getByText("Submit Assignment", { exact: true })).toBeVisible();
  });

  test("Coach opens immediately with one stable assignment-aware question", async ({ page }) => {
    let generateRequests = 0;
    await page.route("**/api/ai-jobs", (route) => {
      generateRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "This opening should not be requested." }),
      });
    });

    await page.addInitScript(() => {
      const data = JSON.parse(localStorage.getItem("praxis_mock_data"));
      data.submissions[0].chatHistory = [];
      data.submissions[0].planningChatMessages = [];
      data.submissions[0].planningCoachHistory = [];
      localStorage.setItem("praxis_mock_data", JSON.stringify(data));
    });

    await page.goto("/student");
    await page.getByRole("button", { name: /Continue Assignment/ }).click();

    const openingQuestionText =
      "What is the strongest reason someone might disagree with your position on “Student workflow audit,” and what evidence could help you answer them?";
    const openingQuestion = page.getByText(openingQuestionText, { exact: true });
    await expect(openingQuestion).toBeVisible();

    const savedOpening = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("praxis_mock_data"));
      return data.submissions[0].chatHistory?.[0]?.text || "";
    });
    expect(savedOpening).toBe(openingQuestionText);
    expect(generateRequests).toBe(0);
  });

  test("saved Coach conversation survives Draft to Coach navigation", async ({ page }) => {
    let generateRequests = 0;
    await page.route("**/api/ai-jobs", (route) => {
      generateRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ response: "This should not replace saved chat." }),
      });
    });

    await page.addInitScript(() => {
      const data = JSON.parse(localStorage.getItem("praxis_mock_data"));
      data.submissions[0].planningChatMessages = [];
      data.submissions[0].planningCoachHistory = [];
      localStorage.setItem("praxis_mock_data", JSON.stringify(data));
      localStorage.setItem("praxis_student_step_overrides", JSON.stringify({
        student_flow_assignment: 2,
      }));
    });

    await page.goto("/student");
    await page.getByRole("button", { name: /Continue Assignment/ }).click();
    await expect(page.getByText("Draft Editor", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to Coach", exact: true }).click();

    await expect(page.getByText("I want to argue against it.", { exact: true })).toBeVisible();
    expect(generateRequests).toBe(0);
  });

  test("editing the draft does not clear saved planning notes", async ({ page }) => {
    const savedNotes = "- Protect innocent people\n- Explain irreversible mistakes";
    await page.addInitScript((notes) => {
      if (sessionStorage.getItem("planning_notes_fixture_ready")) return;
      const data = JSON.parse(localStorage.getItem("praxis_mock_data"));
      data.assignments[0].autoOutlineFromChat = true;
      data.submissions[0].outline = {
        chatOutlineText: notes,
        chatOutlineMeta: { edited: true },
      };
      localStorage.setItem("praxis_mock_data", JSON.stringify(data));
      localStorage.setItem("praxis_student_step_overrides", JSON.stringify({
        student_flow_assignment: 2,
      }));
      sessionStorage.setItem("planning_notes_fixture_ready", "1");
    }, savedNotes);

    await page.goto("/student");
    await page.getByRole("button", { name: /Continue Assignment/ }).click();

    const notes = page.getByRole("textbox", { name: "Editable planning outline" });
    const draft = page.getByRole("textbox", { name: /Draft editor/ });
    await expect(notes).toHaveValue(savedNotes);
    const editedNotes = `${savedNotes}\n- Add a concrete case`;
    await notes.fill(editedNotes);
    await page.waitForTimeout(500);
    await draft.fill("A newly edited draft that triggers persistence without replacing notes.");
    await page.waitForTimeout(700);
    await expect(notes).toHaveValue(editedNotes);

    await page.getByRole("button", { name: "Back to Coach", exact: true }).click();
    await page.getByRole("button", { name: "Continue to Draft", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Editable planning outline" })).toHaveValue(editedNotes);

    await page.reload();
    await expect(page).toHaveURL(/assignment=student_flow_assignment/);
    await expect(page).toHaveURL(/step=2/);
    await expect(page.getByRole("textbox", { name: "Editable planning outline" })).toHaveValue(editedNotes);
  });

  test("failed submit keeps the draft editable and never shows false success", async ({ page }) => {
    let submitAttempts = 0;
    await page.route("**/api/assignments/student_flow_assignment/submit", async (route) => {
      submitAttempts += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary database outage" }),
      });
    });
    await page.addInitScript(() => {
      const data = JSON.parse(localStorage.getItem("praxis_mock_data"));
      data.submissions[0].selfRubricScores = {
        criterion_1: { bandId: "good", score: 3 },
        criterion_2: { bandId: "good", score: 3 },
      };
      localStorage.setItem("praxis_mock_data", JSON.stringify(data));
      localStorage.setItem("praxis_student_step_overrides", JSON.stringify({
        student_flow_assignment: 4,
      }));
    });

    await page.goto("/student");
    await page.getByRole("button", { name: /Continue Assignment/ }).click();
    await expect(page.getByText("Step 4: Submit Assignment", { exact: true })).toBeVisible();
    const submitButton = page.getByRole("button", { name: "Submit", exact: true }).last();
    await page.getByRole("button", { name: /Confirm this is your own work/ }).click();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(page.getByText(/could not reach the database/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assignment Submitted" })).not.toBeVisible();
    await expect(submitButton).toBeEnabled();
    expect(submitAttempts).toBe(1);

    const stored = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("praxis_mock_data"));
      return data.submissions.find((item) => item.id === "student_flow_submission");
    });
    expect(stored.status).toBe("draft");
    expect(stored.finalText).toContain("death penalty should be abolished");
  });

  test("paste warning uses the in-app review modal", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("praxis_student_step_overrides", JSON.stringify({
        student_flow_assignment: 2,
      }));
    });

    await page.goto("/student");
    await page.getByRole("button", { name: /Continue Assignment/ }).click();
    await page.getByRole("button", {
      name: "Draft & Feedback",
      exact: true,
    }).click();

    const editor = page.getByRole("textbox", { name: /Draft editor/ });
    await editor.fill("Original text");
    await editor.evaluate((element) => {
      element.setSelectionRange(element.value.length, element.value.length);
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", " pasted quote");
      element.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }));
    });

    const pasteDialog = page.getByRole("dialog", { name: "Paste detected" });
    await expect(pasteDialog).toBeVisible();
    await page.getByRole("button", { name: "Keep Pasted Text" }).click();
    await expect(editor).toHaveValue("Original text pasted quote");
    await expect(page.getByRole("status")).toContainText("Paste detected");
    await expect(
      page.getByRole("button", { name: "Continue to Rubric Check", exact: true })
    ).toBeInViewport();

    await editor.evaluate((element) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", " should be removed");
      element.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }));
    });
    await page.getByRole("button", { name: "Remove Pasted Text" }).click();
    await expect(editor).toHaveValue("Original text pasted quote");
  });

  test("tab focus refresh preserves continuous drafting before later typing and paste", async ({ page }) => {
    const apiFixture = buildStudentWorkflowFixture();
    await page.route("**/api/student/classes", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        classes: [{
          id: "student_flow_class",
          name: "English",
          invite_code: "ENG",
          is_published: true,
        }],
        pendingClasses: [],
      }),
    }));
    await page.route("**/api/classes/student_flow_class/assignments", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          assignments: [apiFixture.assignments[0]],
        }),
      })
    );
    await page.route("**/api/student/submissions**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          submissions: [apiFixture.submissions[0]],
        }),
      })
    );
    let latestSavedPayload = null;
    await page.route("**/api/submissions/student_flow_submission", async (route) => {
      const payload = route.request().postDataJSON();
      latestSavedPayload = payload;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          submission: {
            id: "student_flow_submission",
            assignment_id: "student_flow_assignment",
            student_id: "student_flow_student",
            status: "draft",
            ...payload,
            version: 2,
            updated_at: new Date().toISOString(),
          },
        }),
      });
    });
    await page.addInitScript(() => {
      const data = JSON.parse(localStorage.getItem("praxis_mock_data"));
      data.submissions[0].draftText = "";
      data.submissions[0].finalText = "";
      data.submissions[0].content = "";
      data.submissions[0].writingEvents = [];
      localStorage.setItem("praxis_mock_data", JSON.stringify(data));
      localStorage.setItem("praxis_student_step_overrides", JSON.stringify({
        student_flow_assignment: 2,
      }));
    });

    await page.goto("/student");
    await page.getByRole("button", { name: /Continue Assignment/ }).click();
    await page.getByRole("button", {
      name: "Draft & Feedback",
      exact: true,
    }).click();

    const editor = page.getByRole("textbox", { name: /Draft editor/ });
    const firstSession = "This text was written before switching tabs.";
    await editor.fill(firstSession);

    // Browser tab changes blur the editor, then reload lightweight workspace
    // state when focus returns.
    await editor.blur();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(editor).toHaveValue(firstSession);

    await editor.focus();
    await editor.press("End");
    await editor.pressSequentially(" This text was written after returning.");
    const beforePaste = `${firstSession} This text was written after returning.`;
    await expect(editor).toHaveValue(beforePaste);

    await editor.evaluate((element) => {
      element.setSelectionRange(element.value.length, element.value.length);
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", " PASTED ENDING");
      element.dispatchEvent(new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }));
    });
    await page.getByRole("button", { name: "Keep Pasted Text" }).click();
    await expect(editor).toHaveValue(`${beforePaste} PASTED ENDING`);

    await expect.poll(
      () => latestSavedPayload?.draft_text,
      { timeout: 5000 }
    ).toBe(`${beforePaste} PASTED ENDING`);
    expect(
      latestSavedPayload.writing_events.some(
        (event) =>
          event.type === "replace" &&
          String(event.removedText || "").includes(firstSession)
      )
    ).toBe(false);
  });

  test("coach, draft, feedback, rubric and submit remain one ordered flow", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));

    await page.goto("/student");
    await page.getByRole("button", { name: /Continue Assignment/ }).click();
    await expect(page.getByText("Step 1: Plan Your Ideas", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Continue to Draft", exact: true }).click();
    const skipCoachDialog = page.getByRole("heading", { name: "Continue without using the Coach?" });
    if (await skipCoachDialog.isVisible()) {
      await page.getByRole("button", { name: "Continue to Draft", exact: true }).last().click();
    }
    await expect(page.getByText("Step 2: Draft & Feedback", { exact: true })).toBeVisible();
    await expect(page.getByText("Draft Editor", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Continue to Rubric Check", exact: true }).click();
    await expect(page.getByText("Draft Editor", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stay in Draft", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to Rubric", exact: true })).toBeInViewport();
    await expect(page.getByRole("textbox", { name: /Draft editor/ })).toBeInViewport();
    await page.getByRole("button", { name: "Stay in Draft", exact: true }).click();
    await expect(page.getByText("Draft Editor", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "AI Feedback", exact: true }).click();
    await expect(page.getByText("Your paragraph with AI highlights", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Feedback", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Continue to Rubric Check", exact: true }).click();
    await expect(page.getByRole("button", { name: "Continue to Rubric", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stay in AI Feedback", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Rubric", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Rubric Self-Assessment" })).toBeVisible();
    await expect(page.getByText("Step 3: Rubric Check", { exact: true })).toBeVisible();
    await expect(page.getByText("Submit Assignment", { exact: true })).not.toBeVisible();

    await page.getByRole("button", { name: "Back to AI Feedback", exact: true }).click();
    await expect(page.getByText("Your paragraph with AI highlights", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Rubric", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rubric Self-Assessment" })).toBeVisible();
    await expect(page.getByText("Step 3: Rubric Check", { exact: true })).toBeVisible();

    const goodBand = page.getByRole("button", {
      name: "Good Meets expectations. 3/4",
      exact: true,
    });
    await goodBand.click();
    const secondCriterion = page
      .getByRole("button", { name: /Evidence & Support/ })
      .filter({ has: page.getByText("Evidence & Support", { exact: true }) })
      .first();
    await expect(secondCriterion).toHaveAttribute("aria-pressed", "true");
    await goodBand.click();
    await page.getByRole("button", { name: "Save & Continue to Submit", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Rubric Self-Assessment" })).not.toBeVisible();
    await expect(page.getByText("Step 4: Submit Assignment", { exact: true })).toBeVisible();
    await expect(page.getByText("Submit Assignment", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Step 4: Submit Assignment", { exact: true })).toBeVisible();
    await expect(page.getByText("Submit Assignment", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Rubric", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rubric Self-Assessment" })).toBeVisible();
    await expect(page.getByText("2/2 criteria", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close Rubric", exact: true }).click();
    await expect(page.getByText("Submit Assignment", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Draft & Feedback", exact: true }).click();
    await expect(page.getByText("Draft Editor", { exact: true })).toBeVisible();
    const draftEditor = page.getByRole("textbox", { name: /Draft editor/ });
    await draftEditor.fill(Array.from({ length: 401 }, (_, index) => `word${index}`).join(" "));
    await page.getByRole("button", { name: "Submit", exact: true }).first().click();
    const overLimitSubmit = page.getByRole("button", { name: "Submit", exact: true }).last();
    await expect(overLimitSubmit).toBeDisabled();
    await expect(page.getByText(/words above maximum/i)).toBeVisible();

    await page.getByRole("button", { name: "Draft & Feedback", exact: true }).click();
    await draftEditor.fill("A revised draft within the allowed maximum word count. Latest top-tab update.");
    await draftEditor.fill(`${await draftEditor.inputValue()} Latest top-tab update.`);
    await page.getByRole("button", { name: "Submit", exact: true }).first().click();
    await expect(page.getByText("Submit Assignment", { exact: true })).toBeVisible();
    await expect(page.getByText(/Latest top-tab update\./)).toBeVisible();

    await page.getByRole("button", { name: "Draft & Feedback", exact: true }).click();
    await expect(page.getByText("Draft Editor", { exact: true })).toBeVisible();
    await draftEditor.fill(`${await draftEditor.inputValue()} Latest continue update.`);
    await page.getByRole("button", { name: "Continue to Submit", exact: true }).click();
    await expect(page.getByText(/Latest continue update\./)).toBeVisible();

    const submitButton = page.getByRole("button", { name: "Submit", exact: true }).last();
    await expect(submitButton).toBeDisabled();

    await page.getByRole("button", { name: /Confirm this is your own work/ }).click();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    await expect(page.getByRole("heading", { name: "Assignment Submitted" })).toBeVisible();
    await expect(page.getByText("This assignment has been submitted. Editing is locked.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Back to Assignments", exact: true }).click();
    await expect(page.getByRole("button", { name: "View Submission", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "View Submission", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Assignment Submitted" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Coach", exact: true })).toBeDisabled();

    expect(errors).toEqual([]);
  });
});
