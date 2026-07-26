import { requestJson } from "./auth.js";

async function request(path, options = {}) {
  return requestJson(path, options, { errorPrefix: "Report request failed" });
}

export async function createBugReport(report = {}) {
  const {
    description,
    screenshot = null,
    route = "",
    ...context
  } = report;
  const data = await request("/api/bug-reports", {
    method: "POST",
    body: JSON.stringify({
      description,
      screenshot,
      route,
      context,
    }),
  });
  return data.report;
}

export async function getAdminBugReports() {
  const data = await request("/api/admin/bug-reports");
  return Array.isArray(data.reports) ? data.reports : [];
}

export async function getAdminBugReportAttachment(reportId) {
  const data = await request(
    `/api/admin/bug-reports/${encodeURIComponent(reportId)}/attachment`
  );
  return data.url;
}

export async function updateAdminBugReport(reportId, patch) {
  const data = await request(`/api/admin/bug-reports/${encodeURIComponent(reportId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.report;
}
