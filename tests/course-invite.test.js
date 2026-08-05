const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(
  path.join(__dirname, "../frontend/src/utils/courseInvite.js")
).href;

test("course invite URLs normalize and encode the course code", async () => {
  const { buildCourseInvitePath, buildCourseInviteUrl } = await import(moduleUrl);

  assert.equal(buildCourseInvitePath(" ab c "), "/join?code=AB%20C");
  assert.equal(
    buildCourseInviteUrl({ code: " praxis-42 " }, "https://praxis.example/"),
    "https://praxis.example/join?code=PRAXIS-42"
  );
});

test("course invite message contains both direct link and manual fallback code", async () => {
  const { buildCourseInviteMessage } = await import(moduleUrl);
  const message = buildCourseInviteMessage(
    { name: "Academic Writing", semester: "Fall 2026", code: "write42" },
    "https://praxis.example",
    "Dr. Example"
  );

  assert.match(message, /https:\/\/praxis\.example\/join\?code=WRITE42/);
  assert.match(message, /Access code: WRITE42/);
  assert.match(message, /Instructor: Dr\. Example/);
  assert.match(message, /create an account/i);
});

test("course invites use the production join URL by default", async () => {
  const { buildCourseInviteMessage } = await import(moduleUrl);
  const message = buildCourseInviteMessage(
    { name: "AWG1001Test", semester: "Fall 2027", code: "AWG4785" },
    undefined,
    "Professor Example"
  );

  assert.match(
    message,
    /Join link: https:\/\/praxisproject\.netlify\.app\/join\?code=AWG4785/
  );
});

test("empty course codes never produce a misleading join link", async () => {
  const { buildCourseInvitePath, buildCourseInviteUrl } = await import(moduleUrl);

  assert.equal(buildCourseInvitePath(""), "");
  assert.equal(buildCourseInviteUrl({}, "https://praxis.example"), "");
});

test("pending invitations survive authentication navigation and clear after joining", async () => {
  const {
    clearPendingCourseInvite,
    getPendingCourseInvite,
    rememberPendingCourseInvite,
  } = await import(moduleUrl);
  rememberPendingCourseInvite(" kok3880 ");
  assert.equal(getPendingCourseInvite(), "KOK3880");
  clearPendingCourseInvite();
  assert.equal(getPendingCourseInvite(), "");
});
